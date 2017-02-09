var toastOptions = {
  "closeButton": true,
  "debug": false,
  "newestOnTop": false,
  "progressBar": true,
  "positionClass": "toast-top-right",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "3000",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}

var versionUpdates = {
	"1.0.2" : {
		data : [
			"Added trade and auction links.",
			"Changed subject to reflect last message subject from other user.",
			"Redesigned a few things"
		],
		next : "1.0.3",
		date : "1/31/2017"
	},
	"1.0.3" : {
		data : [
			"Changed a few layouts",
			"Added a remove messages from user button",
			"Added display of current storage used",
			"Changed notifications library",
			"Added changelog view on extension update",
			"Fixed bug when exchanging more than 1 message with a user on the same minute",
			"Added import and export buttons"
		],
		prev : "1.0.2",
		next : "1.0.4",
		date : "2/1/2017"
	},
	"1.0.4" : {
		data : [
			"Added write mail button to write to new users",
			"Fixed a notification bug",
			"Added changelog notification on extension install",
			"Added navigation for changelogs",
			"Added date to changelogs"
		],
		prev : "1.0.3",
		date : "2/9/2017"
	}
}

function formatBytes (bytes,decimals) {
   if(bytes == 0) return '0 Bytes';
   var k = 1000,
       dm = decimals + 1 || 3,
       sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
       i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


function makeToast (type, title, body, options) {

	var opt = {}

	Object.assign(opt, toastOptions, options || {});

	toastr[type](body, title || "", opt);

}

function showUpdates (version) {
	var message = $("<div></i><ul style = 'text-align : left'></ul></div>");
	var title = $("<div><i class='fa fa-arrow-left hide'></i>What's new in "+version+"<i class='fa fa-arrow-right hide'></i><div class = 'date' /></div>");

	if (versionUpdates.hasOwnProperty(version)) {

		if (versionUpdates[version].hasOwnProperty("prev")) {
			title.find(".fa-arrow-left").show();
		}

		if (versionUpdates[version].hasOwnProperty("next")) {
			title.find(".fa-arrow-right").show();
		}

		title.find(".date").text(versionUpdates[version].date)

		message.find("ul").append(versionUpdates[version].data.map(v => $("<li>" + v + "</li>")));
	}

	makeToast("info", title.html(), message.html(), {timeOut : "45000", extendedTimeOut : "5000", preventDuplicates : true, tapToDismiss : false});

	$(".fa-arrow-left").click(function () {
		toastr.remove()
		showUpdates(versionUpdates[version].prev);
	})

	$(".fa-arrow-right").click(function () {
		toastr.remove()
		showUpdates(versionUpdates[version].next);
	})

}

function importData (event) {
	var obj = JSON.parse(event.target.result);
	
	try {
		if (obj.hasOwnProperty("data") && obj.hasOwnProperty("version") && obj.hasOwnProperty("from") && obj.from == "neochat") {
			for (var key in obj.data) {
				if (obj.data[key] instanceof Object && obj.data[key].hasOwnProperty("users")) {
					chrome.runtime.sendMessage({type : "setStorage", user : key, data : obj.data[key]});
				}
			}
		} else {
			throw new Error("Not a neochat export file");
		}
	} catch (ex) {
		makeToast("error", null, "Error importing : " + ex.message);
	}
}

function gmtDate () {
	var d = new Date();
	d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
	return d;
}