chrome.runtime.onMessage.addListener(processMessage);


var data = {};
var pending = [];


function defaultData(user) {
	var obj = {}
	obj[user] = {"users" : {}, "messageId" : 0};
	return obj;
}

function noop () {}

function processMessage (request, sender, sendResponse) {
	sendResponse = sendResponse || noop;

	if (request.type == "smilies") {
		
	}
	
	if (!data[request.user]) {
		initialize(request, processMessage.bind(this, request, sender, sendResponse));
		return true; // to allow async response
	}

	if (request.type.includes("Storage") || request.type == "getId") {
		if (request.type == "getStorage") {
			sendResponse(data[request.user]);
		} else if (request.type == "setStorage") {
			merge(request.data, data[request.user])
			merge(data[request.user], request.data)

			pending.push({callback : sendResponse, user : request.user});

			if (pending.length == 1) commit();

			return true; // to allow async response

		} else if (request.type == "getId") {
			sendResponse(data[request.user].messageId++)
			
			pending.push({callback : noop, user : request.user});

			if (pending.length == 1) commit ();

			return true; // to allow async response
		}
	} else if (request.type == "reset") {
		if (request.recipient) {
			delete data[request.user].users[request.recipient];
		} else {
			delete data[request.user];
		}
		pending.push({callback : noop, user : request.user});
		commit();
		return true; // to allow async response
	}

  }

function initialize (request, callback) {
	chrome.storage.local.get(defaultData(request.user), function (result) {
		data[request.user] = result[request.user];
		callback();
	})
} 

function merge (obj1, obj2) {
	for (var attr in obj1) {
		if (obj2.hasOwnProperty(attr) == false) {
			obj2[attr] = obj1[attr];
		} else {
			if (obj1[attr] instanceof Object) {
				merge(obj1[attr], obj2[attr]);
			} else {
				obj2[attr] = obj1[attr];
			}
		}
	}
}

function commit () {
	var obj = pending.shift();
	var temp = {}
	temp[obj.user] = data[obj.user];

	chrome.storage.local.set(temp, function(){
		obj.callback(data[obj.user]);
		if (pending.length) commit();
	});
}



var requestCache = {}

chrome.webRequest.onBeforeRequest.addListener(
	function(details) {
  		if (details.url == "http://www.neopets.com/process_neomessages.phtml" && details.method == "POST" && details.requestBody && details.requestBody.formData && details.requestBody.formData.recipient[0]) {
  			requestCache[details.requestId] = details;
			setTimeout(function(){
				delete requestCache[details.requestId];
			}, 60000);
  		}

	}, 
	{urls: ["http://www.neopets.com/process_neomessages.phtml"]},
	["requestBody"]
);

chrome.webRequest.onBeforeRedirect.addListener(
	function (details) {
		if (details.url == "http://www.neopets.com/process_neomessages.phtml" && details.method == "POST" && details.statusCode == 302 && requestCache.hasOwnProperty(details.requestId)) {
			var cache = requestCache[details.requestId]

			chrome.cookies.get({url : "http://www.neopets.com", name : "neoremember"}, function (result) {
				var user = result.value;

				var d = new Date(Math.floor(details.timeStamp));
				d.setMinutes(d.getMinutes() + new Date().getTimezoneOffset())

				var message = {
					from : user,
					date : d.getTime(),
					subject : cache.requestBody.formData.subject[0],
					text : cache.requestBody.formData.message_body[0]
				}

				for (var text in textToSmilies) {
					message.text = message.text.split(text).join(`<img border="0" src="${textToSmilies[text]}">`);
				}

				if (cache.requestBody.formData.reply_message_id) message.reply_message_id = cache.requestBody.formData.reply_message_id[0]; 

				processMessage({type: "getId", user : user}, null, function (id) {
					var fromId = cache.requestBody.formData.recipient[0];
					var from = data[user].users[fromId] || (data[user].users[fromId] = {messages : {}, lastMessage : null})
					
					if (from.lastMessage == null || from.messages[from.lastMessage].date < message.date) {
						from.lastMessage = id;
					}

					from.messages[id] = message;

					processMessage({type : "setStorage", user : user, data : data[user]}, null, function () {
						
					})
				})


			})

			
		}
	},
	{urls: ["http://www.neopets.com/process_neomessages.phtml"]}
);
