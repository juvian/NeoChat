var chat = new NeoChat();
var user = $(".user a:eq(0)").text();

var data;
var ui;
var time = new timeago();

var fakeUser = {topic : "Hi"};
var pendingUser = null;

const lol = {
    cursorcolor: '#cdd2d6',
    cursorwidth: '4px',
    cursorborder: 'none',
    horizrailenabled : false
};

const conf = {
    cursorcolor: '#696c75',
    cursorwidth: '4px',
    cursorborder: 'none'
};




chrome.storage.onChanged.addListener(function (changes, name) {
	if (name == "local" && changes.hasOwnProperty(user)) {
		data = changes[user].newValue;
		processSideBar();
		loadMessages();
		loadTemplates();
		showBytesInUse();
	}
});

chrome.storage.local.get("messages", function (result) {
	if (result.messages && result.messages.update) {
		showUpdates(result.messages.update);
		delete result.messages.update;
		chrome.storage.local.set({"messages" : result.messages});
	}
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
  		if (request && request.type == "changeUser") {
  			pendingUser = request.user;
  			if (ui != null) changeUser(); 			
  		}
  	}
 );

function changeUser () {
	if (pendingUser == null) return;

	if (lis.hasOwnProperty(pendingUser)) {
		ui.find(".left-menu input.search").val(pendingUser);
		filterUsers();
		selectUser($(lis[pendingUser]));
		loadMessages();
	} else {
		showNewMailMenu();
		ui.find("input.fake").val(pendingUser);
	}

	pendingUser = null;
}

function sortAttr(attr) {
	return (a, b) => parseInt($(b).attr(attr)) - parseInt($(a).attr(attr));
}

function initSearch (ui) {
    ui.find("input.search").on("input", filterUsers);
}

function filterUsers () {
	let ul = ui.get(0).querySelector('.list-users');
	let fake = ul.querySelector('.fake-user');
	let active = ui.find(".list-users li.active").attr("data-username");
	ul.innerHTML = '';	

	var filter = ui.find("input.search").val().toLowerCase();

	let filtered = usernames.filter(u => {
		let user = data.users[u];
		return (user.name || "").toLowerCase().includes(filter) || u.toLowerCase().includes(filter)
	})

	if (filtered.length == 0) {
		dates = usernames.reduce((cur, u) => {
			let user = data.users[u];
			let messages = Object.values((user.messages || {})).filter(msg => (msg.text + msg.subject).toLowerCase().includes(filter)).sort((a, b) => b.date - a.date);
			if (messages.length) cur[u] = messages[0].date
			return cur;
		}, {})

		filtered = Object.keys(dates).sort((a, b) => dates[b] - dates[a]);
	}

	let frag = document.createDocumentFragment();
	frag.appendChild(fake);
	filtered.forEach(u => frag.appendChild(lis[u]))
	ul.appendChild(frag);

	if(filtered.includes(active)) lis[active].classList.add("active");
	else if (lis[active]) lis[active].classList.remove("active");
}


let usernames = [];
let lis = {};

function createUser(username, active) {
	var u = data.users[username];
	var dt = new Date(u.messages[u.lastMessage].date);
	dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
	return `<li class="${username == active ? 'active' : ''}" data-username="${username}">
		<img width="50" height="50" src="${u.image || " "}">
		<div class="chat-user-info">
			<div class="chat-user">${(u.name || "") + " (" + username + ")"}</div>
			<div class="chat-date" datetime="${dt.getTime().toString()}"></div>
		</div>
	</li>`
}

function processSideBar () {
	
	var init = ui == null;

	ui = init ? chat.fullChatTemplate.clone() : ui;

	usernames = Object.keys(data.users).filter(u => data.users[u].lastMessage != null && Object.keys(data.users[u].messages).length > 0).sort(function(a, b){
		return data.users[b].messages[data.users[b].lastMessage].date - data.users[a].messages[data.users[a].lastMessage].date || b - a;
	});

	let body = new DOMParser().parseFromString(usernames.map(u => createUser(u)).join(""), "text/html").body

	for (let li of body.querySelectorAll('li')) {
		lis[li.getAttribute("data-username")] = li;
	}

	time.render(body.querySelectorAll(".chat-date"));

	filterUsers();

	if (init) {

		ui.on("mousedown", ".list-users li", function() {
			if (!this.classList.contains('active')) {
		        selectUser($(this));
		    	loadMessages();	  
		    }
		})

		ui.on("click", ".bubble .fa-edit", function () {
			let name = this.closest('.bubble').getAttribute('title');
			$(".template-name").val(name)
			$(".write-template textarea").val(data.templates[name].message);
		})

		ui.on("click", ".bubble .fa-close", function () {
			let name = this.closest('.bubble').getAttribute('title');
			chrome.runtime.sendMessage({type : "removeTemplate", user : user, name: name});
		})

		ui.on("click", ".content div", function () {
			let name = $(this).text();
			this.closest(".write").querySelector("textarea").value += data.templates[name].message;
			this.closest(".templates").classList.add("hide");
		})

	
		$("div[align='center']").filter(function(){return $(this).text().indexOf("neochat |") != -1}).eq(0).next().after(ui).prevUntil("b").remove();
		
		$('.list-users').niceScroll(conf);
	    $('body').niceScroll(conf);

	    
	    chat.chatTemplate.find(".smilies").append(Object.keys(smiliesToText).map(v => $(`<div class = 'smilie' data-text = '${smiliesToText[v]}'><img src = '${v}'></img></div>`).get(0)))

	    initSearch(ui);

	    ui.before(chat.configurationTemplate.clone());

	    initConfiguration();

	    initNewMail();

	    changeUser();

	}

	showBytesInUse();

}

chrome.runtime.sendMessage({type : "getStorage", user : user}, function(response) {
	data = response;
	chat.loadTemplates().then(function(){
		processSideBar();
	})
})

function fixLinks(str) {
	return str.replace(/(impress\.openneo\.net[^\s]*)/gi, function(a){
	    return `<a href = 'https://${a}' target='_blank'>${a}</a> ` 
	}).replace(/(items\.jellyneo\.net[^\s]*)/gi, function(a){
	    return `<a href = 'https://${a}' target='_blank'>${a}</a> ` 
	})
}

var offset = moment().tz('America/Los_Angeles').utcOffset()

function createMessage (message) {
	var bubble = chat.messageTemplate.clone()

	if (!message.template) {
		var dt = new Date(message.date);
		dt.setMinutes(dt.getMinutes() + offset);
		bubble.attr("data-date", (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear());
		var date = ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);
		if (!message.draft) bubble.find(".time").text(date).appendTo(bubble.find(".body"))
	}

	bubble.attr("title", message.subject);
	bubble.find(".body").html(fixLinks(message.text))

	bubble.addClass(message.from == user ? "me" : "you")
	bubble.find((message.from == user ? ".left-arrow" : ".right-arrow")).remove()

	if (message.draft) {
		bubble.addClass("draft").attr("title", "Message failed to be sent. Click to copy message");
		bubble.click(function() {
			ui.find(".write-message textarea").val(message.text);
			ui.find(".write-message .topic").val(message.subject);
		})
	}

	if (message.template) {
		bubble.addClass("template");
		bubble.find('.body').append("<i class='fa fa-close'></i>").prepend("<i class='fa fa-edit'></i>")
	}

	return bubble;
}

function addDateSeparators () {

	var lastDate = null;

	ui.find(".messages .bubble").each(function(){
		var currDate = $(this).data('date');
		if (currDate != lastDate) {
			lastDate = currDate;
			$(this).before("<div class = 'hr-sect'>"+currDate+"</div>");
		}
	})

}

function filterMessages () {
	var filter = ui.find(".top input.search").val().toLowerCase();

	ui.find(".chat .messages .bubble").hide().filter(function(){
		return $(this).text().toLowerCase().includes(filter);
	}).show();

	ui.find(".chat .messages .hr-sect").hide().filter(function(){
		return $(this).parent().find(".bubble[data-date='"+$(this).text()+"']:visible").length;
	}).show();
}

function loadMessages () {
	var li = ui.find("li.active");

	if (li.length == 0 || li.hasClass("fake-user")) return;

	var username = li.attr("data-username");
	var user = data.users[username];

	var messages = Object.keys(user.messages).sort(function(a, b) {
		return user.messages[a].date - user.messages[b].date;
	});

	var chat = ui.find(".chat")

	chat.find(".top").show();
	chat.find(".write-message .fake-row").hide();
	chat.find(".write-message textarea").removeClass("show-less");

	chat.find(".avatar img").attr("src", (user.image || " "));

	chat.find(".info .name").text((user.name || username));
	chat.find(".info .count").text(messages.length + " messages");	

	ui.find(".chat .messages").empty();

	ui.find(".messages").append(messages.map(id => createMessage(user.messages[id])));

	if (user.draft) {
		ui.find(".messages").append(createMessage(Object.assign(user.draft, {draft: true})));
	}

	addDateSeparators(messages);

	filterMessages();

	ui.find(".messages").scrollTop(ui.find(".messages").prop("scrollHeight"));

	var subject = "Hi";

	for (var i = 0; i < messages.length;i++) {
		var msg =  user.messages[messages[i]];
		if (msg.from != user) {
			subject =  msg.subject.startsWith("Re: ") ?  msg.subject : "Re: " +  msg.subject;
		}
	}

	if (ui.find(".write-message textarea").val().trim() == "" || ui.find(".write-message textarea").val().trim() == "Hi") ui.find(".write-message .topic").val(subject);

	ui.find(".top .auctions").attr("href", "genie.phtml?type=find_user&auction_username=" + username)
	ui.find(".top .trades").attr("href", "island/tradingpost.phtml?type=browse&criteria=owner&search_string=" + username)
}


function selectUser (li) {
	ui.find(".chat").removeClass("template");
	$('.list-users li.active').removeClass('active');
	li.addClass('active')
	
	if (ui.find(".chat").length == 0) { 
		initChat();
		
		ui.find(".smilie").click(function () {
			$(this).closest(".write").find("textarea").val($(this).closest(".write").find("textarea").val() + $(this).attr("data-text") + " ")
			ui.find(".smilies").addClass("hide")
		})

		ui.find(".smiley").click(function () {
			ui.find(".smilies").toggleClass("hide")
		})

		ui.find(".select-template").click(function() {
			let div = ui.find(".templates")
			div.toggleClass("hide")
			if (div.is(":visible")) {
				let html = Object.keys(data.templates).map(name => `<div class='template-name'>${name}</div>`).join('');
				div.find(".content").html(html);
			}
		})

		ui.find(".top input.search").on("input", function () {
			filterMessages(ui);
		});

		ui.find(".send").click(function () {
			let username = ui.find("li.active").hasClass("fake-user") ? ui.find(".fake-username").val() : ui.find("li.active").attr("data-username");

			var subject = ui.find(".topic").val();
			var message = ui.find(".write-message textarea").val();

			ui.find(".write-message textarea").val("")

			var form = $(`<form name="neomessage" action="process_neomessages.phtml" method="post">
						<input class="recipient" type="text" name="recipient"/>
						<input class = "subject" type="text" name="subject"/>
						<select name="message_type" onchange="update_title()">
							<option value="notitle" selected>notitle</option>
						</select>
						<input type="text" name="neofriends"/>
						<textarea name="message_body" class="message_body"></textarea>`);

			form.find(".message_body").val(message)
			form.find(".subject").val(subject)
			form.find(".recipient").val(username)

			$.post("http://www.neopets.com/process_neomessages.phtml", new URLSearchParams(new FormData(form.get(0))).toString()).success(function(html){
				if ($(html).find(".errormess").length) {
					makeToast("error", null, $(html).find(".errormess .errormess .errormess").html().split("<br>")[0]);
					ui.find(".write-message textarea").val(message)
				} else {
					makeToast('success', null, "Message sent");
				}
			}).error(function () {
				makeToast('error', null, "Network error, try again later");
				ui.find(".write-message textarea").val(message);
			})
		})

		ui.find(".user-actions .erase").click(function () {
			var username = ui.find("li.active").attr("data-username");

			if (confirm("Are you sure you want to remove the data from user " + username + "?")) {
				var d = new Date();
				d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
				chrome.runtime.sendMessage({type : "removeMessages", user : user, time: d.getTime(), username: username});
			}

			return false;
		})

		ui.find(".actions .fa-save").click(function() {
			let name = ui.find(".template-name").val().trim();
			if (name) {
				chrome.runtime.sendMessage({type : "updateTemplate", user : user, name: name, message: ui.find(".write-template textarea").val()});
			}
		})

		$('.chat textarea').niceScroll(lol);
		$('.messages').niceScroll(lol);

		$(".ui .top .trades").children("img").attr("src", chrome.extension.getURL("images/trades.png"));
		$(".ui .top .auctions").children("img").attr("src", chrome.extension.getURL("images/auctions.png"));

	}
}

function showBytesInUse () {
	chrome.storage.local.getBytesInUse(null, function(v) {
		$(".configuration .storage-used").text("Used " + formatBytes(v, 2)); // + " / " + formatBytes(chrome.storage.local.QUOTA_BYTES, 2));	
	})
}


function initConfiguration () {
	$(".configuration .view-changelog").click(function() {
		showUpdates(chrome.runtime.getManifest().version);
	});

	$(".configuration .import-data").click(function() {
		$(".configuration").find("input").click();
	})

	$(".configuration").find("input").change(function(e) {
		if (event.target.files && this.value.match(/\.([^\.]+)$/)[1] == "json") {
			var reader = new FileReader();
	        reader.onload = importData;
	        reader.readAsText(event.target.files[0]);
		}
	})

	$(".configuration .export-data").click(function() {
		chrome.runtime.sendMessage({type : "export"});
	})

	$(".configuration .create-template").click(function(){
		selectUser($(".fake-user"));
		ui.find(".chat").addClass("template");
		ui.find(".top").hide();

		loadTemplates();
	})
}

function loadTemplates() {
	if (ui.find(".chat.template").length == 0) return;
	ui.find(".chat .messages").empty();
	let templates = data.templates || {};
	let bubbles = Object.keys(templates).sort().map(name => createMessage({text: name + " : " + templates[name].message, subject: name, template: true, from: user}));
	ui.find(".chat .messages").append(bubbles);
}

function showNewMailMenu () {
	selectUser($(".fake-user"));

	var chat = ui.find(".chat");

	ui.find(".chat .messages").empty();

	chat.find(".top").hide();

	chat.find(".topic").val(fakeUser.topic);

	chat.find(".fake-row").show();
	chat.find(".fake-username").focus();

	chat.find(".write-message textarea").addClass("show-less");	
}

function initNewMail () {
	ui.find(".fa-pencil-square-o").click(showNewMailMenu)
}

function initChat () {

	ui.append(chat.chatTemplate.clone());

	ui.find(".user-info .avatar").click(function(){
		chrome.runtime.sendMessage({type : "newTab", url : "http://www.neopets.com/userlookup.phtml?user=" +  ui.find("li.active").attr("data-username")});
	});
}