var chat = new NeoChat();
var user = $(".user a:eq(0)").text();

var data;
var ui;
var time = new timeago();

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
	}
})


function initSearch (ui) {
    ui.find("input.search").on("input", filterUsers);
}

function filterUsers () {
	var filter = ui.find("input.search").val().toLowerCase();

	ui.find(".list-users li").each(function(){
		var user = data.users[$(this).attr("data-username")];

		if ((user.name || "").toLowerCase().includes(filter) || $(this).attr("data-username").toLowerCase().includes(filter)) {
			$(this).removeClass("hide");
		} else {
			$(this).addClass("hide");
		}
	})
}

function processSideBar () {
	
	var init = ui == null;

	ui = init ? chat.fullChatTemplate.clone() : ui;

	var usernames = Object.keys(data.users).sort(function(a, b){
		return data.users[b].messages[data.users[b].lastMessage].date - data.users[a].messages[data.users[a].lastMessage].date;
	});

	var users = [];

	time.cancel();

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
		$("div[align='center']").filter(function(){return $(this).text().indexOf("neochat") != -1}).eq(0).next().after(ui);
		
		$('.list-users').niceScroll(conf);
	    $('body').niceScroll(conf);
	    
	    chat.chatTemplate.find(".smilies").append(Object.keys(smiliesToText).map(v => $(`<div class = 'smilie' data-text = '${smiliesToText[v]}'><img src = '${v}'></img></div>`).get(0)))

	    initSearch(ui);
	}

	filterUsers();


}

chrome.runtime.sendMessage({type : "getStorage", user : user}, function(response) {
	data = response;

	chat.loadTemplates().then(function(){
		processSideBar();
	})
})

function createMessage (message) {
	var bubble = chat.messageTemplate.clone();
	bubble.find(".body").html(message.text)

	var dt = new Date(message.date);
	dt.setMinutes(dt.getMinutes() - 60 * 8);

	var date = ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2);

	bubble.find(".time").text(date).appendTo(bubble.find(".body"))
	
	bubble.addClass(message.from == user ? "me" : "you")
	bubble.find((message.from == user ? ".left-arrow" : ".right-arrow")).remove()

	return bubble;
}


function filterMessages (ui) {
	var filter = ui.find(".top input.search").val();

	ui.find(".chat .messages .bubble").hide().filter(function(){
		return $(this).text().toLowerCase().includes(filter);
	}).show();
}

function loadMessages () {
	var li = ui.find("li.active");

	if (li.length == 0) return;

	var username = li.attr("data-username");
	var user = data.users[username];

	var messages = Object.keys(user.messages).sort(function(a, b) {
		return user.messages[a].date - user.messages[b].date;
	});

	var chat = ui.find(".chat")

	chat.find(".avatar img").attr("src", (user.image || " "));
	chat.find(".info .name").text((user.name || username));
	chat.find(".info .count").text(messages.length + " messages");	

	ui.find(".chat .messages").empty();

	ui.find(".messages").append(messages.map(id => createMessage(user.messages[id])));

	filterMessages(ui);

	ui.find(".messages").scrollTop(ui.find(".messages").prop("scrollHeight"));

	var subject = "Hi";

	for (var i = 0; i < messages.length;i++) {
		var msg =  user.messages[messages[i]];
		if (msg.from != user) {
			subject =  msg.subject.startsWith("Re: ") ?  msg.subject : "Re: " +  msg.subject;
		}
	}

	if (ui.find(".write textarea").val().trim() == "") ui.find(".write .topic").val(subject);

	ui.find(".top .auctions").attr("href", "genie.phtml?type=find_user&auction_username=" + username)
	ui.find(".top .trades").attr("href", "island/tradingpost.phtml?type=browse&criteria=owner&search_string=" + username)
}

function addListener (li) {
	li.mousedown(function(){
	    if ($(this).hasClass('active')) {
	        return false;
	    } else {
	    	$('.list-users li.active').removeClass('active');
	    	$(this).addClass('active')

	    	var ui = $(this).parents(".ui");
	    	
	    	if (ui.find(".chat").length == 0) { 
	    		ui.append(chat.chatTemplate.clone());
	    		
	    		ui.find(".smilie").click(function () {
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
	    			var user = ui.find("li.active").attr("data-username");
	    			var subject = ui.find(".topic").val();
	    			var message = ui.find(".write textarea").val();

	    			ui.find(".write textarea").val("")

	    			$.ajax({url : "http://www.neopets.com/process_neomessages.phtml", type : "post", data : {recipient : user, subject : subject, message_type : "notitle", neofriends : "", message_body : message}}).success(function(html){
	    				if ($(html).find(".errormess").length) {
	    					$().toastmessage('showErrorToast', $(html).find(".errormess").html().split("<br>")[0].split("</b>")[1]);
	    					ui.find(".write textarea").val(message)
	    				} else {
	    					$().toastmessage('showSuccessToast', "Message sent");
	    				}
	    			}).error(function () {
	    				$().toastmessage('showErrorToast', "Error, try again later");
	    				ui.find(".write textarea").val(message)
	    			})
	    		})

	    		$('.chat textarea').niceScroll(lol);
	    		$('.messages').niceScroll(lol);

	    		$(".ui .top .trades").children("img").attr("src", chrome.extension.getURL("images/trades.png"));
	    		$(".ui .top .auctions").children("img").attr("src", chrome.extension.getURL("images/auctions.png"));

	    	}

	    	loadMessages();
	    	
	    }
	});
}