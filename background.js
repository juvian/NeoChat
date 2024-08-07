chrome.runtime.onMessage.addListener(processMessage);
chrome.runtime.onInstalled.addListener(processInstall);

var data = {};
var pending = [];
var userPending = null;

function changeNeoChatUser (user, tab) {
	chrome.tabs.sendMessage(tab.id, {type : "changeUser", user : user})
}

function tabsCallback(user, tabs) {
    for (var i = 0, tab; tab = tabs[i]; i++) {
      if (tab.url && tab.url.indexOf("://www.neopets.com/neomessages.phtml?folder=neochat") != -1) {
        chrome.tabs.update(tab.id, {active: true}, changeNeoChatUser.bind(this, user));
        return;
      }
    }
    chrome.tabs.create({url: "https://www.neopets.com/neomessages.phtml?folder=neochat"});
    userPending = user;
}

function goToNeoChat(user) {
  this.browser ? browser.tabs.query({currentWindow: true}).then(tabsCallback.bind(this, user)) : chrome.tabs.getAllInWindow(undefined, tabsCallback.bind(this, user));	 
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tab.url && tab.url.indexOf("://www.neopets.com/neomessages.phtml?folder=neochat") != -1 && changeInfo.status == 'complete' && userPending) {
        chrome.tabs.update(tab.id, {selected: true}, changeNeoChatUser.bind(this, userPending));
        userPending = null;
    }
});


function defaultData(user) {
	var obj = {}
	obj[user] = {"users" : {}};
	return obj;
}

function noop () {}

var contextMenu = chrome.contextMenus.create({
	targetUrlPatterns : ["*://www.neopets.com/randomfriend.phtml*", "*://www.neopets.com/userlookup.phtml*"],
	title : "Neochat user",
	contexts : ["link"],
	type : "normal",
	onclick : function(a, b) {
		var user = a.linkUrl.split(".phtml?")[1].split("=")[1].split("&")[0];
		goToNeoChat(user);
	}
})


function processMessage (request, sender, sendResponse) {	
	if (request.type == "contextMenu") {
		chrome.contextMenus.update(contextMenu, {title : "Neochat " + request.user})
	} else if (!data[request.user]) {
		initialize(request, processMessage.bind(this, request, sender, sendResponse));
	} else {
		if (request.type == 'removeTemplate') {
			delete data[request.user].templates[request.name];
			pending.push({user : request.user});
		} else if (request.type == 'updateTemplate') {
			data[request.user].templates = data[request.user].templates || {};
			data[request.user].templates[request.name] = data[request.user].templates[request.name] || {}
			data[request.user].templates[request.name].message = request.message;
			pending.push({user : request.user});
		} else if (request.type == "removeMessages") {
			data[request.user].users[request.username].lastDelete = request.time;
			checkLastDelete(Object.keys(data[request.user].users), data[request.user], null);
			pending.push({user : request.user});
		} else if (request.type.includes("Storage")) {
			if (request.type == "getStorage") {
				sendResponse(data[request.user]);
				return false;
			} else if (request.type == "setStorage") {
				mergeData(data[request.user], request.data)
				pending.push({user : request.user});
			}
		} else if (request.type == "reset") {
			if (request.recipient) {
				delete data[request.user].users[request.recipient];
			} else {
				delete data[request.user];
			}
			pending.push({user : request.user});
		} else if (request.type == "export") {
			var obj = {
				data : request.data || data,
				from : "neochat",
				version : chrome.runtime.getManifest().version,
				date : gmtDate().getTime()
			}

			var json = JSON.stringify(obj);

			var blob = new Blob([json], {type: "application/json"});
			var url  = URL.createObjectURL(blob);

			chrome.downloads.download({url : url, filename : "neochat_export_"+obj.date+".json", saveAs : true});
		} else if (request.type == "addMessage") {
			var userData = data[request.user].users;
			var from = userData[request.from] = userData[request.from] || {messages : {}, lastMessage : null};

			if (from.lastDelete && request.message.date <= from.lastDelete) return;

			if (from.messages.hasOwnProperty(request.messageID) == false) {
				from.messages[request.messageID] = request.message;
			}

			if (from.lastMessage == null || from.messages[from.lastMessage].date < request.message.date) {
				from.lastMessage = request.messageID;
				from.image = request.image;
				from.name = request.name;
			}

			if (from.name == null) from.name = request.name;
			if (from.image == null) from.image = request.image;
			
			//fix wrong text saved by show reply fix tnt did on July 10th
			if (from.messages[request.messageID].text != request.message.text && request.message.date >= new Date("2024-07-06T00:00:00") && request.message.date <= new Date("2024-09-06T00:00:00")) {
				from.messages[request.messageID].text = request.message.text;
			}

			from.name = from.name.trim().toLowerCase()

			pending.push({user : request.user});
		}
		commit();
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
	
	obj1.templates = obj1.templates || {};
	obj2.templates = obj2.templates || {};

	merge(obj1.templates, obj2.templates);

	checkLastDelete(users, obj1, obj2);
}

function checkLastDelete(users, obj1, obj2) {
	users.forEach(function(user) {

		if (obj1.users[user].lastDelete || (obj2 && obj2.users[user].lastDelete)) {
			obj1.users[user].lastDelete = Math.max.apply(null, [obj1.users[user].lastDelete, obj2 ? obj2.users[user].lastDelete : null].map(v => {if (v == null || v == -Infinity || !v) {return 0}; return v;}));

			Object.keys(obj1.users[user].messages).forEach(function (key) {
				if (obj1.users[user].messages[key].date <= obj1.users[user].lastDelete) delete obj1.users[user].messages[key];
			})
		}

		updateLastMessage(obj1.users[user]);

	});
}

function merge (obj1, obj2) {

	var attrs = Object.keys(obj1).concat(Object.keys(obj2));
	
	for (var i = 0 ; i < attrs.length; i++) {

		if (attrs[i] == "lastDelete") continue;

		if(obj1[attrs[i]] == null) {
			obj1[attrs[i]] = obj2[attrs[i]];
			continue;
		} else if (obj2[attrs[i]] == null) {
			obj2[attrs[i]] = obj1[attrs[i]];
			continue;
		}
		
		if (obj1[attrs[i]] instanceof Object) {
			merge(obj1[attrs[i]], obj2[attrs[i]]);
		} else {
			obj1[attrs[i]] = obj2[attrs[i]] || obj1[attrs[i]];
		}
	}	
}

function _commit () {
	var obj = pending.shift();
	var temp = {}
	temp[obj.user] = data[obj.user];

	chrome.storage.local.set(temp, function(){
		if (pending.length) _commit();
		else _commit.working = false;
	});
}

function commit () {
	if (_commit.working != true && pending.length) {
		_commit.working = true;
		_commit();
	}
}

var requestCache = {}

chrome.webRequest.onBeforeRequest.addListener(
	function(details) {
		if (details.url.indexOf("://www.neopets.com/process_neomessages.phtml") != -1 && details.method == "POST" && details.requestBody && details.requestBody.raw) console.log(details)
			
  		if (details.url.indexOf("://www.neopets.com/process_neomessages.phtml") != -1 && details.method == "POST" && details.requestBody && details.requestBody.formData && details.requestBody.formData.recipient[0]) {
  			requestCache[details.requestId] = details;
			setTimeout(function(){
				delete requestCache[details.requestId];
			}, 60000);
  		}

	}, 
	{urls: ["*://www.neopets.com/process_neomessages.phtml"]},
	["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
	function(details) {
		if(details.url.indexOf("://www.neopets.com/process_neomessages.phtml") != -1 && details.method == "POST" && details.statusCode == 200 && requestCache.hasOwnProperty(details.requestId)) {
			var cache = requestCache[details.requestId]
			saveMessage(cache, false);
		}
	}, 
	{urls: ["*://www.neopets.com/process_neomessages.phtml"]}
)

chrome.webRequest.onBeforeRedirect.addListener(
	function (details) {
		if (details.url.indexOf("://www.neopets.com/process_neomessages.phtml") != -1 && details.method == "POST" && details.statusCode == 302 && requestCache.hasOwnProperty(details.requestId)) {
			var cache = requestCache[details.requestId]
			saveMessage(cache, true);
		}
	},
	{urls: ["*://www.neopets.com/process_neomessages.phtml"]}
);

function saveMessage(cache, success) {
	chrome.cookies.get({url : "https://www.neopets.com", name : "neologin"}, function (result) {
		var user = decodeURIComponent(result.value).split("+")[0];

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

		var fromId = cache.requestBody.formData.recipient[0].trim().toLowerCase();
		
		processMessage({type : "getStorage", user : user}, null, function (userData) {
			var from = userData.users[fromId] || (userData.users[fromId] = {messages : {}, lastMessage : null})
			
			if (success) {
				if (from.lastMessage == null || from.messages[from.lastMessage].date < message.date) {
					from.lastMessage = id;
				}

				from.messages[id] = message;
				delete from.draft
			} else {
				from.draft = message;
			}

			processMessage({type : "setStorage", user : user, data : userData}, null, noop);
		});
	})

}



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
    	if (isLowerOrEqual(details.previousVersion, "1.0.13")) { // fix rare cases of not lowercase usernames and not trimmed
    		chrome.storage.local.get(null, data => {
    			for (let usr in data) {
    				if(data[usr] instanceof Object && data[usr].hasOwnProperty("users")) {
    					processMessage({type : "getStorage", user : usr}, null, function (userData) {
    						for (var u in userData.users) {
    							if (u != u.trim().toLowerCase()) {
    								if (userData.users.hasOwnProperty(u.trim().toLowerCase())) {
    									merge(userData.users[u.trim().toLowerCase()], userData.users[u]);
    									updateLastMessage(userData.users[u.trim().toLowerCase()]);
    								} else {
    									userData.users[u.trim().toLowerCase()] = userData.users[u];
    								}
    								delete userData.users[u];
    							}
    						}
    						processMessage({type : "setStorage", user : usr, data : userData}, null, noop);
    					})	
    				}
    			}
    		})
    	}
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

	chrome.storage.local.get({"messages" : {}}, function (result) {
		result.messages.update = chrome.runtime.getManifest().version;
		chrome.storage.local.set({"messages" : result.messages});
	})
}

function gmtDate () {
	var d = new Date();
	d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
	return d;
}