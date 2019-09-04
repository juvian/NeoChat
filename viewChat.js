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

function initSearch (ui) {
    ui.find("input.search").on("input", filterUsers);
}

function filterUsers () {
	var filter = ui.find("input.search").val().toLowerCase();
	var lis = ui.find(".list-users li").not(".fake-user");

	lis.each(function(){
		var user = data.users[$(this).attr("data-username")];

		if ((user.name || "").toLowerCase().includes(filter) || $(this).attr("data-username").toLowerCase().includes(filter)) {
			$(this).removeClass("hide");
		} else {
			$(this).addClass("hide");
		}
	});

	if (lis.filter(":visible").length == 0) {
		lis.each(function(){
			var user = data.users[$(this).attr("data-username")];

			if (user.messages != null && Object.keys(user.messages).filter(msg => user.messages[msg].text.toLowerCase().includes(filter) || user.messages[msg].subject.toLowerCase().includes(filter)).length) {
				$(this).removeClass("hide");
			}
		});
	}
}

function processSideBar () {
	
	var init = ui == null;

	ui = init ? chat.fullChatTemplate.clone() : ui;

	var usernames = Object.keys(data.users).filter(u => data.users[u].lastMessage != null && Object.keys(data.users[u].messages).length > 0).sort(function(a, b){
		return data.users[b].messages[data.users[b].lastMessage].date - data.users[a].messages[data.users[a].lastMessage].date || b - a;
	});

	var users = [];

	timeago.cancel();

	usernames.forEach(function (username) {
		var u = data.users[username];
		var dt = new Date(u.messages[u.lastMessage].date);
		dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
		
		if (ui.find("li[data-username='"+username+"']").length) {
			var li = $(ui.find("li[data-username='"+username+"']")[0]);
			time.render(li.find(".chat-date").attr("datetime", dt.getTime().toString()));
			users.push(li)
		} else {
			var user = chat.userTemplate.clone();
			
			user.attr("data-username", username);

			user.find("img").attr("src", (u.image || " "));

			user.find(".chat-user").text((u.name || "") + " (" + username + ")");

			time.render(user.find(".chat-date").attr("datetime", dt.getTime().toString()));

			addListener(user);

			users.push(user);
		}
	});

	ui.find(".list-users").append(users);

	if (init) {
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
	})
}

var offset = moment().tz('America/Los_Angeles').utcOffset()

function createMessage (message) {
	var dt = new Date(message.date);
	dt.setMinutes(dt.getMinutes() + offset);

	var bubble = chat.messageTemplate.clone().attr("data-date", (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear());
	bubble.find(".body").html(fixLinks(message.text))

	var date = ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);

	bubble.find(".time").text(date).appendTo(bubble.find(".body"))
	
	bubble.addClass(message.from == user ? "me" : "you")
	bubble.find((message.from == user ? ".left-arrow" : ".right-arrow")).remove()

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

function addListener (li) {
	li.mousedown(function(){
	    if ($(this).hasClass('active')) {
	        return false;
	    } else {
	    	selectUser(li);
	    	loadMessages();	    	
	    }
	});
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
					makeToast("error", null, $(html).find(".errormess").html().split("<br>")[0].split("</b>")[1]);
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