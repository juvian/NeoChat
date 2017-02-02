chrome.runtime.onMessage.addListener(processMessage);
chrome.runtime.onInstalled.addListener(processInstall);

var data = {};
var pending = [];


function defaultData(user) {
	var obj = {}
	obj[user] = {"users" : {}};
	return obj;
}

function noop () {}

function processMessage (request, sender, sendResponse) {	

	if (!data[request.user]) {
		initialize(request, processMessage.bind(this, request, sender, sendResponse));
	} else {

		if (request.type.includes("Storage")) {
			if (request.type == "getStorage") {
				sendResponse(data[request.user]);
				return false;
			} else if (request.type == "setStorage") {
				mergeData(data[request.user], request.data)

				pending.push({user : request.user});

				if (pending.length == 1) commit();
				
			}
		} else if (request.type == "reset") {
			if (request.recipient) {
				delete data[request.user].users[request.recipient];
			} else {
				delete data[request.user];
			}
			pending.push({callback : noop, user : request.user});
			commit();
		} else if (request.type == "export") {
			var obj = {
				data : data,
				from : "neochat",
				version : chrome.runtime.getManifest().version,
				date : gmtDate().getTime()
			}

			var json = JSON.stringify(obj);

			var blob = new Blob([json], {type: "application/json"});
			var url  = URL.createObjectURL(blob);

			chrome.downloads.download({url : url, filename : "neochat_export_"+obj.date+".json", saveAs : true});
		}
	}

	return true;

  }

function initialize (request, callback) {
	chrome.storage.local.get(defaultData(request.user), function (result) {
		data[request.user] = result[request.user];
		callback();
	})
} 

function mergeData (obj1, obj2) {
	var users = Object.keys(obj1.users).concat(Object.keys(obj2.users));

	merge(obj1.users, obj2.users);

	users.forEach(function(user) {

		if (obj1.users[user].lastDelete || obj2.users[user].lastDelete) {
			obj1.users[user].lastDelete = Math.max.apply(null, [obj1.users[user].lastDelete, obj2.users[user].lastDelete].map(v => {if (v == null || v == -Infinity || !v) {return 0}; return v;}));

			Object.keys(obj1.users[user].messages).forEach(function (key) {
				if (obj1.users[user].messages[key].date <= obj1.users[user].lastDelete) delete obj1.users[user].messages[key];
			})
		}

		updateLastMessage(obj1.users[user]);

	});
}

function merge (obj1, obj2) {

	if (obj1 == null && obj2 instanceof Object) obj1 = {};
	if (obj2 == null && obj1 instanceof Object) obj2 = {};

	var attrs = Object.keys(obj1).concat(Object.keys(obj2));
	
	for (var i = 0 ; i < attrs.length; i++) {

		if (attrs[i] == "lastDelete") continue;
		
		if (obj1[attrs[i]] instanceof Object) {
			merge(obj1[attrs[i]], obj2[attrs[i]]);
		} else {
			obj1[attrs[i]] = obj2[attrs[i]] || obj1[attrs[i]];
		}
	}	
}

function commit () {
	var obj = pending.shift();
	var temp = {}
	temp[obj.user] = data[obj.user];

	chrome.storage.local.set(temp, function(){
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

				var d = new Date(Math.floor(cache.timeStamp));
				d.setMinutes(d.getMinutes() +d.getTimezoneOffset())

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

				var id = d.getTime();

				var fromId = cache.requestBody.formData.recipient[0];
				var from = data[user].users[fromId] || (data[user].users[fromId] = {messages : {}, lastMessage : null})
				
				if (from.lastMessage == null || from.messages[from.lastMessage].date < message.date) {
					from.lastMessage = id;
				}

				from.messages[id] = message;

				processMessage({type : "setStorage", user : user, data : data[user]}, null, noop);


			})

			
		}
	},
	{urls: ["http://www.neopets.com/process_neomessages.phtml"]}
);



function isLowerOrEqual (v1, v2) {
	var versions1 = v1.split(".");
	var versions2 = v2.split(".");

	for (var i = 0 ; i < Math.max(versions1.length, versions2.length); i++) {
		if (Number (versions1[i]) > Number (versions2[i])) return false;
	}

	return versions2.length >= versions1.length;

}

function updateLastMessage(user) {
	user.lastMessage = Object.keys(user.messages).sort(function(a, b) {
		return user.messages[b].date - user.messages[a].date;
	}).concat([null])[0]
}

function processInstall (details) {
    if(details.reason == "install") {
       
    }else if(details.reason == "update") {
        if (isLowerOrEqual(details.previousVersion, "1.0.2")) { // delete deprecated messageId and change old sent messages ids to new format
        	chrome.storage.local.get(null, function (data) {
        		for (let usr in data) {
        			if(data[usr] instanceof Object && data[usr].hasOwnProperty("users")) {
        				processMessage({type : "getStorage", user : usr}, null, function (userData) {
        					if(userData.messageId) delete userData.messageId;
        					
        					for (var u in userData.users) {
        						var keys = Object.keys(userData.users[u].messages).filter(m => Number(m) < 100000);
        						
        						for (var i = 0; i < keys.length; i++) {
        							var msg = userData.users[u].messages[keys[i]];
        							userData.users[u].messages[msg.date] = msg;
        							delete userData.users[u].messages[keys[i]];
        						}

        						Object.keys(userData.users[u].messages).filter(m => userData.users[u].messages[m].hasOwnProperty("date") == false).forEach(msg => delete userData.users[u].messages[msg]);

        						updateLastMessage(userData.users[u]);

        					}
        					processMessage({type : "setStorage", user : usr, data : userData}, null, noop);
        				});
        			}
        		}
        	});
        }
    }

    if(details.reason == "update") {
    	chrome.storage.local.get({"messages" : {}}, function (result) {
    		result.messages.update = chrome.runtime.getManifest().version;
    		chrome.storage.local.set({"messages" : result.messages});
    	})
    }
}

function gmtDate () {
	var d = new Date();
	d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
	return d;
}