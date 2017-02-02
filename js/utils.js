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
	"1.0.3" : [
		"Changed a few layouts",
		"Added a remove messages from user button",
		"Added display of current storage used",
		"Changed notifications library",
		"Added changelog view on extension update",
		"Fixed bug when exchanging more than 1 message with a user on the same minute",
		"Added import and export buttons"
	]
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
	options = options || {};

	Object.assign({}, toastOptions, options);

	toastr[type](body, title || "", options);

}

function showUpdates (version) {
	var message = $("<div><ul style = 'text-align : left'></ul></div>");
	
	if (versionUpdates.hasOwnProperty(version)) {
		message.find("ul").append(versionUpdates[version].map(v => $("<li>" + v + "</li>")));
	}

	makeToast("info", "What's new in " + version, message.html(), {timeOut : "45000", extendedTimeOut : "5000", preventDuplicates : true});
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