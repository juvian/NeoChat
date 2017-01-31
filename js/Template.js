class Template {

	static get (url) {
		return new Promise(function(resolve, reject){
			$.ajax({
			    url: chrome.extension.getURL("template/" + url + ".html"),
			    dataType: "html",
			    success: resolve,
			    error : reject
			})
		});
	}

}