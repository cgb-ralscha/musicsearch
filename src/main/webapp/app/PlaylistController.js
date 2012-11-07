Ext.define('MusicSearch.PlaylistController', {
	extend: 'Deft.mvc.ViewController',
	inject: 'playlistStore',

	playlistStore: null,
	currentSound: null,

	observe: {
		playlistStore: {
			datachanged: 'onPlaylistDatachanged',
			clear: 'onPlaylistDatachanged'
		},
	},

	control: {
		playlistGridPanelView: {
			selector: 'gridview',
			listeners: {
				beforedrop: 'onPlaylistGridPanelViewBeforedrop'
			}
		},
		view: {
			selectionchange: 'onSelectionchange'
		},
		playButton: {
			click: 'onPlayButtonClick'
		},
		pauseButton: {
			click: 'onPauseButtonClick'
		},

		prevButton: true,
		nextButton: true,
		removeButton: {
			click: 'onRemoveButtonClick'
		},
		clearButton: {
			click: 'onClearButton'
		},

		progressSlider: {
			change: 'onProgressSliderChange'
			//position change does not work properly	
			//changecomplete: 'onProgressSliderChangeComplete'
		},
		volumeSlider: {
			change: 'onVolumeSliderChange'
		},
		progressText: true
	},

	init: function() {
	},

	onPlaylistDatachanged: function(store) {
		if (store.getCount() > 0) {
			this.getPlayButton().enable();
			this.getClearButton().enable();
		} else {
			this.getPlayButton().disable();
			this.getPauseButton().disable();
			this.getPrevButton().disable();
			this.getNextButton().disable();
			this.getRemoveButton().disable();
			this.getClearButton().disable();
			this.getProgressSlider().disable();
		}
	},

	onSelectionchange: function() {
		var selectedModels = this.getView().getSelectionModel().getSelection();
		if (selectedModels && selectedModels.length >= 1) {
			this.getRemoveButton().enable();
		} else {
			this.getRemoveButton().disable();
		}
	},

	onPlayButtonClick: function() {
		var selectedModels = this.getView().getSelectionModel().getSelection();
		if (selectedModels && selectedModels.length >= 1) {
			this.playSong(selectedModels[0].data);
		} else {
			this.playSong(this.playlistStore.first().data);
		}
	},

	onPauseButtonClick: function(button) {
		if (button.pressed) {
			if (this.currentSound) {
				this.currentSound.pause();
			}
		} else {
			if (this.currentSound) {
				this.currentSound.resume();
			}

		}
	},

	onRemoveButtonClick: function() {
		var selectedModels = this.getView().getSelectionModel().getSelection();
		var playing = false;
		Ext.each(selectedModels, function(item) {
			if (item.data.playing) {
				playing = true;
				return false;
			}
		});
		
		if (playing) {
			if (this.currentSound) {
				this.currentSound.stop();
				this.currentSound.destruct();
				this.currentSound = null;
			}			
		}
		
		this.playlistStore.remove(selectedModels);
	},

	onClearButton: function() {
		if (this.currentSound) {
			this.currentSound.stop();
			this.currentSound.destruct();
			this.currentSound = null;
		}
		
		this.playlistStore.removeAll();
	},

	onVolumeSliderChange: function(slider, newValue) {
		if (this.currentSound) {
			this.currentSound.setVolume(newValue);
		}
	},

	onProgressSliderChange: function(slider, newValue) {
		var position; 
		var duration; 

		if (this.currentSound && this.currentSound.playState === 1) {
			position = this.currentSound.position;
			duration = this.currentSound.duration;
		} else {
			position = 0;
			duration = 0;			
		}
		
		if (!isNaN(position) && !isNaN(duration)) {
			var currentTimeFmt = MusicSearch.Utils.secondsToHms(position / 1000);
			var durationFmt = MusicSearch.Utils.secondsToHms(duration / 1000);
			this.getProgressText().setText(currentTimeFmt + ' / ' + durationFmt);
		}
	},

	
//	onProgressSliderChangeComplete: function(slider, newValue) {
//		if (this.currentSound) {
//			this.currentSound.setPosition((newValue / 100) * this.currentSound.duration);
//		}
//	},

	togglePause: function(state) {
		this.getPauseButton().enable();
		this.getPauseButton().toggle(state, false);
	},

	setNowPlaying: function(song) {
		if (song) {
			this.getView().setTitle(
					'Now playing: ' + song.title + ' - ' + song.artist);
		} else {
			this.getView().setTitle('Now playing: ');
		}
	},

	updateProgress: function() {
		var slider = this.getProgressSlider();
		
		if (this.currentSound) {
			var duration = this.currentSound.duration;
	
			if (duration > 0) {
				if (!slider.thumbs[0].dragging) {
					slider.setValue((this.currentSound.position / duration) * 100);
				}
			} else {
				slider.setValue(0);
			}
		} else {
			slider.setValue(0);
		}
	},

	playSong: function(song) {

		if (this.currentSound) {
			this.currentSound.destruct();
		}

		var me = this;
		
		this.currentSound = soundManager.createSound({
			id: 'currentSound',
			url: app_context_path + 'downloadMusic?name=' + song.fileName,
			type: song.encoding,		
			autoLoad: true,
			autoPlay: true,
			volume: this.getVolumeSlider().getValue(),
			onstop: function() {
				me.onSoundManagerStop(me, this);
			},
			onfinish: function() {
				me.onSoundManagerStop(me, this);
			},
			onplay: function() {
				me.onSoundManagerPlay(me, this);
			},
			whileplaying: function() {
				me.onSoundManagerWhilePlaying(me, this);
			},
		});
		
		this.setNowPlaying(song);
		
		this.playlistStore.each(function(record) { 
			record.data.playing = false; 
		});
		
		song.playing = true;
	},

	onSoundManagerStop: function(controller, sound) {
		controller.togglePause(true);
		controller.getPauseButton().disable();
		controller.getProgressSlider().disable();
		controller.setNowPlaying(null);		
		controller.getProgressSlider().setValue(0);		
	},
	
	onSoundManagerPlay: function(controller, sound) {
		controller.togglePause(false);
		controller.getProgressSlider().enable();
	},
	
	onSoundManagerWhilePlaying: function(controller, sound) {
		controller.updateProgress();
	},
	
	onPlaylistGridPanelViewBeforedrop: function(node, data, overModel,
			dropPosition, dropFunction, eOpts) {
		// todo need better implementation for this
		for ( var i = 0; i < data.records.length; i++) {
			if (this.playlistStore.indexOfId(data.records[i].getId()) === -1) {
				this.playlistStore.add(data.records[i]);
			}
		}
		return false;
	}

});
