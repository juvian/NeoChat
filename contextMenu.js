document.addEventListener("mousedown", function(event){
    if (event.button !== 2) {
        return false;
    }

    if (event.target && event.target.tagName == "A" && event.target.href.indexOf("/randomfriend.phtml?user=") != -1) {
        chrome.runtime.sendMessage({type : "contextMenu", user : event.target.href.split("user=")[1]})
    }
    
});