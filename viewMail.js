var messageID = window.location.toString().split("&id=")[1].split("&")[0]
var user = $(".user a:eq(0)").text();
var offset = moment().tz('America/Los_Angeles').utcOffset()

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
	d.setSeconds(59);
	d.setMinutes(d.getMinutes() - offset); 

	var now =  new Date();
	now.setMinutes(now.getMinutes() + now.getTimezoneOffset());

	return Math.min(d.getTime(), now.getTime());
}


var table = $(".sidebar").siblings(".content").find("table").eq(0);
var fromId = table.find("a[href^='/userlookup.phtml?user=']").attr("href").split("?user=")[1];

var message = {
	from : fromId,
	date : getDate(table.find("tr:eq(1) td:eq(1)").text()),
	folder : table.find("tr:eq(2) td:eq(1)").text(),
	subject : table.find("tr:eq(3) td:eq(1)").text()
}

setData(table.find("tr:last-child td:eq(1)"), message);



chrome.runtime.sendMessage({
	type : "addMessage",
	user : user,
	from : fromId.toLowerCase(),
	messageID : messageID,
	image : table.find("tr:eq(0) img").attr("src"),
	name : table.find("a[href^='/userlookup.phtml?user=']").next().text(),
	message : message
}, function(response) {

});

