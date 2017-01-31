var messageID = window.location.toString().split("&id=")[1].split("&")[0]
var user = $(".user a:eq(0)").text();

function setData (el, message) {
	var div = el.clone();


	div.find("img").each(function() {
		var url = decodeURIComponent($(this).attr("src"));
		if (url.includes("fansite")) url = url.split("?r=")[1]
		$(this).attr("src", url);
	})

	div.find("a").each(function() {
		var url = decodeURIComponent($(this).attr("href"));
		if (url.includes("fansite")) url = url.split("?r=")[1]
		$(this).attr("href", url);
		$(this).attr("target", "_blank")		
	});

	message.text = div.html()

}

function getDate (txt) {
	var d = new Date(txt.split("/")[1] + "/" + txt.split("/")[0] + "/" + txt.split("/")[2].replace("am", " am").replace("pm", " pm").trim());
	d.setMinutes(d.getMinutes() + 60 * 8); 
	return d.getTime();
}

chrome.runtime.sendMessage({type : "getStorage", user : user}, function(response) {
	console.log(response)
	var users = response.users;

	var table = $(".sidebar").siblings(".content").find("table").eq(0);
	var fromId = table.find("a[href^='/userlookup.phtml?user=']").attr("href").split("?user=")[1];
	var from = users[fromId] || (users[fromId] = {messages : {}, lastMessage : null})
	
	var message = {
		from : fromId,
		date : getDate(table.find("tr:eq(1) td:eq(1)").text()),
		folder : table.find("tr:eq(2) td:eq(1)").text(),
		subject : table.find("tr:eq(3) td:eq(1)").text()
	}

	setData(table.find("tr:eq(4) td:eq(1)"), message);

	var changed = false;

	if (from.messages.hasOwnProperty(messageID) == false) {
		from.messages[messageID] = message;

		changed = true;
	}


	if (from.lastMessage == null || from.messages[from.lastMessage].date < message.date) {
		from.lastMessage = messageID;
		from.image = table.find("tr:eq(0) img").attr("src");

		changed = true;
	}

	if (from.name == null) {
		from.name = table.find("a[href^='/userlookup.phtml?user=']").next().text()
		changed = true;
	}

	if (from.image == null) {
		from.image = table.find("tr:eq(0) img").attr("src");
		changed = true;
	}

	if (changed) {
		chrome.runtime.sendMessage({type : "setStorage", data : response, user : user}, function() {

		});
	}


});
