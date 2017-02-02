class NeoChat {
	
	loadTemplates () {
		var self = this;

		return Template.get("fullchat").then(function(html){
			self.fullChatTemplate = $(html);
			return Template.get("user")
		}).then(function(html){
			self.userTemplate = $(html);
			return Template.get("message")
		}).then(function(html){
			self.messageTemplate = $(html);
			return Template.get("chat")
		}).then(function(html){
			self.chatTemplate = $(html);
			return Template.get("configuration")
		}).then(function(html){
			self.configurationTemplate = $(html);
		})
	}

}


