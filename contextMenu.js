document.addEventListener("mousedown", function(event){
    if (event.button !== 2) {
        return false;
    }

    var target = event.path.filter(function(el){return el.tagName == "A"}).concat(null)[0];

    if (target && target.tagName == "A" && (target.href.includes("/randomfriend.phtml?user=") || target.href.includes("/userlookup.phtml?user=") || target.href.includes("/randomfriend.phtml?randomfriend="))) {
        chrome.runtime.sendMessage({type : "contextMenu", user : target.href.split(".phtml?")[1].split("=")[1].split("&")[0]})
    }
    
});