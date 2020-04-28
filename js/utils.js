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

const url = chrome.runtime.getURL('changes.json');
let response = fetch(url).then((r) => r.json());

function showUpdates (version) {
  response.then((versionUpdates) => {
    var message = $("<div></i><ul style = 'text-align : left'></ul></div>");
    var title = $("<div><i class='fa fa-arrow-left hide'></i>What's new in "+version+"<i class='fa fa-arrow-right hide'></i><div class = 'date' /></div>");
    let idx = versionUpdates.findIndex(v => v.version == version);

    if (idx != -1) {

      if (idx > 0) {
        title.find(".fa-arrow-left").show();
      }

      if (idx != versionUpdates.length - 1) {
        title.find(".fa-arrow-right").show();
      }

      title.find(".date").text(versionUpdates[idx].date)


      message.find("ul").append(versionUpdates[idx].data.map(v => $("<li>" + v + "</li>")));
    }

    makeToast("info", title.html(), message.html(), {timeOut : "45000", extendedTimeOut : "5000", preventDuplicates : true, tapToDismiss : false});

    $(".fa-arrow-left").click(function () {
      toastr.remove()
      showUpdates(versionUpdates[idx - 1].version);
    })

    $(".fa-arrow-right").click(function () {
      toastr.remove()
      showUpdates(versionUpdates[idx + 1].version);
    })
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