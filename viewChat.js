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

	var user = $(".list-users li[data-username='"+pendingUser+"']");

	if (user.length) {
		ui.find(".left-menu input.search").val(pendingUser);
		filterUsers();
		selectUser(user);
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
	var filter = ui.find("input.search").val().toLowerCase();

	let lis = Array.from(ui.get(0).querySelectorAll('.list-users li:not(.fake-user)'));
	let visible = false;

	for (let li of lis) {
		li.classList.toggle("hide", true);
	}

	filtered = lis.filter(li => {
		let user = data.users[li.getAttribute("data-username")];
		return (user.name || "").toLowerCase().includes(filter) || li.getAttribute("data-username").toLowerCase().includes(filter);
	})

	filtered = filtered.sort((a, b) => parseInt(b.getAttribute("data-order")) - parseInt(a.getAttribute("data-order")))

	if (filtered.length == 0) {
		filtered = lis.filter(li => {
			let user = data.users[li.getAttribute("data-username")];
			let messages = Object.values((user.messages || {})).filter(msg => (msg.text + msg.subject).toLowerCase().includes(filter)).sort((a, b) => b.date - a.date);
			if (messages.length) {
				li.setAttribute("data-date", messages[0].date)
			}
			return messages.length;
		})

		filtered = filtered.sort((a, b) => parseInt(b.getAttribute("data-date")) - parseInt(a.getAttribute("data-date")))
	}

	let users = ui.get(0).querySelector('.list-users');

	for (let li of filtered) {
		users.appendChild(li);
	}

	for (let li of filtered) {
		li.classList.toggle("hide", false);
	}

}


let exists = new Set();

function createUser(username, idx, active) {
	exists.add(username)
	var u = data.users[username];
	var dt = new Date(u.messages[u.lastMessage].date);
	dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
	return `<li data-order="${-idx}" class="${username == active ? 'active' : ''}" data-username="${username}">
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

	var usernames = Object.keys(data.users).filter(u => data.users[u].lastMessage != null && Object.keys(data.users[u].messages).length > 0).sort(function(a, b){
		return data.users[b].messages[data.users[b].lastMessage].date - data.users[a].messages[data.users[a].lastMessage].date || b - a;
	});

	var users = [];

	timeago.cancel();

	let active = ui.find(".list-users li.active").attr("data-username");
	let html = usernames.filter(u => !exists.has(u)).map((username, idx) => createUser(username, idx, active)).join("");

	ui.find(".list-users").get(0).innerHTML += html;

	time.render(ui.get(0).querySelectorAll('.list-users .chat-date'));

	if (init) {

		ui.on("mousedown", ".list-users li", function() {
			if (!this.classList.contains('active')) {
		        selectUser($(this));
		    	loadMessages();	  
		    }
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

	filterUsers();

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
	var dt = new Date(message.date);
	dt.setMinutes(dt.getMinutes() + offset);

	var bubble = chat.messageTemplate.clone().attr("data-date", (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear());
	bubble.find(".body").html(fixLinks(message.text))

	var date = ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);

	
	bubble.addClass(message.from == user ? "me" : "you")
	bubble.find((message.from == user ? ".left-arrow" : ".right-arrow")).remove()

	if (message.draft) {
		bubble.addClass("draft").attr("title", "Message failed to be sent. Click to copy message");
		bubble.click(function() {
			ui.find(".write textarea").val(message.text);
			ui.find(".write .topic").val(message.subject);
		})
	} else {
		bubble.find(".time").text(date).appendTo(bubble.find(".body"))
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
	chat.find(".write .fake").hide();
	chat.find(".write textarea").removeClass("show-less");

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

	if (ui.find(".write textarea").val().trim() == "" || ui.find(".write textarea").val().trim() == "Hi") ui.find(".write .topic").val(subject);

	ui.find(".top .auctions").attr("href", "genie.phtml?type=find_user&auction_username=" + username)
	ui.find(".top .trades").attr("href", "island/tradingpost.phtml?type=browse&criteria=owner&search_string=" + username)
}


function selectUser (li) {
	$('.list-users li.active').removeClass('active');
	li.addClass('active')
	
	if (ui.find(".chat").length == 0) { 
		initChat();
		
		ui.find(".smilie").click(function () {
			if ($(this).parent())
			ui.find("textarea").val(ui.find("textarea").val() + $(this).attr("data-text") + " ");
			ui.find(".smilies").addClass("hide")
		})

		ui.find(".smiley").click(function () {
			ui.find(".smilies").toggleClass("hide")
		})

		ui.find(".top input.search").on("input", function () {
			filterMessages(ui);
		});

		ui.find(".send").click(function () {
			var user = ui.find("li.active").hasClass("fake-user") ? ui.find(".fake-username").val() : ui.find("li.active").attr("data-username");

			var subject = ui.find(".topic").val();
			var message = ui.find(".write textarea").val();

			ui.find(".write textarea").val("")

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
			form.find(".recipient").val(user)

			$.post("http://www.neopets.com/process_neomessages.phtml", new URLSearchParams(new FormData(form.get(0))).toString()).success(function(html){
				if ($(html).find(".errormess").length) {
					makeToast("error", null, $(html).find(".errormess .errormess .errormess").html().split("<br>")[0]);
					ui.find(".write textarea").val(message)
				} else {
					makeToast('success', null, "Message sent");
				}
			}).error(function () {
				makeToast('error', null, "Network error, try again later");
				ui.find(".write textarea").val(message);
			})
		})

		ui.find(".user-actions .erase").click(function () {
			var username = ui.find("li.active").attr("data-username");

			if (confirm("Are you sure you want to remove the data from user " + username + "?")) {
				var d = new Date();
				d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
				data.users[username].lastDelete = d.getTime();
				chrome.runtime.sendMessage({type : "setStorage", user : user, data : data});
			}

			return false;
		})

		$('.chat textarea').niceScroll(lol);
		$('.messages').niceScroll(lol);

		$(".ui .top .trades").children("img").attr("src", chrome.extension.getURL("images/trades.png"));
		$(".ui .top .auctions").children("img").attr("src", chrome.extension.getURL("images/auctions.png"));

	}
}

function showBytesInUse () {
	chrome.storage.local.getBytesInUse(null, function(v) {
		$(".configuration .storage-used").text("Used " + formatBytes(v, 2) + " / " + formatBytes(chrome.storage.local.QUOTA_BYTES, 2));	
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

}

function showNewMailMenu () {
	selectUser($(".fake-user"));

	var chat = ui.find(".chat");

	ui.find(".chat .messages").empty();

	chat.find(".top").hide();

	chat.find(".topic").val(fakeUser.topic);

	chat.find(".fake").show();
	chat.find(".fake-username").focus();

	chat.find(".write textarea").addClass("show-less");	
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