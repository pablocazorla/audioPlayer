audioApp = function($) {
	"use strict";

	var idCounter = 0,
		loadingSong = false,
		current = null,
		readFile = function(file, done) {

			var reader = new FileReader();

			reader.onload = function(data) {
				done(data);
			};

			reader.readAsDataURL(file);
		};

	var get_songVM = function(file) {
		var vm = {
			id: idCounter,
			loading: ko.observable(true),
			title: ko.observable(''),
			time: ko.observable(),
			duration: ko.observable(),
			volume: ko.observable(100),
			terminar: ko.observable('stop'),
			stopped: true,
			idGraph: 'graph-' + idCounter,
			isPlaying: ko.observable(false)
		};
		idCounter++;


		loadingSong = true;



		// initial values
		var player = Object.create(WaveSurfer),
			isReady = false,
			getTime = function(d) {
				d = Number(d);

				var h = Math.floor(d / 3600);
				var m = Math.floor(d % 3600 / 60);
				var s = Math.floor(d % 3600 % 60);


				var t = (h > 0) ? `00${h}`.slice(-2) + ":" : '';


				return t + `00${m}`.slice(-2) + ":" + `00${s}`.slice(-2);
			};



		// Get Title
		ID3.loadTags(file.name, function() {
			var tags = ID3.getAllTags(file.name);
			var title = tags.title || file.name;
			vm.title(title);
		}, {
			tags: ["title"],
			dataReader: FileAPIReader(file)
		});

		// Get Wave
		setTimeout(function() {
			player.init({
				container: document.querySelector('#' + vm.idGraph),
				cursorColor: '#aaa',
				cursorWidth: 1,
				height: 85,
				waveColor: '#588efb',
				progressColor: '#f043a4'
			});

			readFile(file, function(result) {
				result = file;
				player.loadBlob(result);
			});
		}, 500);
		player.on('ready', function() {

			loadingSong = false;

			current = vm;

			vm.loading(false);
			isReady = true;
			vm.duration(getTime(player.getDuration()));
			vm.time(getTime(0));



			player.on('audioprocess', updateTime);
			player.on('seek', updateTime);
			player.on('finish', finish);


			vm.volume.subscribe(function(v) {
				player.setVolume(0.01 * v);
			});



		});

		var updateTime = function() {
			vm.time(getTime(player.getCurrentTime()));
		};

		var finish = function() {
			var term = vm.terminar();
			switch (term) {

				case 'repeat':
					player.seekTo(0);
					player.play();

					break;
				case 'next':
					vm.stop();
					playListVM.playNext(vm.id);
					break;
				default:
					vm.stop();
			}
		};


		vm.play = function() {
			if (isReady) {
				if (!vm.isPlaying()) {
					player.play();
					vm.stopped = false;
					vm.isPlaying(true);
					playListVM.setCurrentPlaying(vm);
				} else {
					vm.pause();
				}
			}
		};
		vm.pause = function(fromCurrent) {
			if (isReady) {
				player.pause();
				vm.stopped = false;
				vm.isPlaying(false);
				if (!fromCurrent) {
					playListVM.setCurrentPlaying(null);
				}
			}
		};
		vm.stop = function() {
			if (isReady) {
				player.stop();
				vm.stopped = true;
				vm.isPlaying(false);
				vm.time(getTime(0));
				playListVM.setCurrentPlaying(null);
			}
		};
		vm.setCurrent = function() {
			current = vm;
		};

		//
		vm.close = function() {
			current = null;
			vm.stop();
			playListVM.closeSong(vm);
		};
		vm.toTop = function() {
			playListVM.toTop(vm);
		};
		vm.toBottom = function() {
			playListVM.toBottom(vm);
		};



		return vm;
	};

	var playListVM = (function() {
		var vm = {
			songList: ko.observableArray(),
			ready: true
		};

		var currentPlaying = null;

		vm.addSong = function(e) {
			var files = e.originalEvent.dataTransfer.files;
			for (var j = 0; j < files.length; j++) {
				if (files[j].type.match(/audio\/(mp3|mpeg)/)) {
					var newSong = get_songVM(files[j]);
					vm.songList.push(newSong);
				}
			}
		};

		vm.setCurrentPlaying = function(v) {
			if (v == null) {
				currentPlaying = null;
			} else {
				if (currentPlaying !== null) {
					if (currentPlaying.id !== v.id) {
						if (!currentPlaying.stopped) {
							currentPlaying.pause(true);
						}
					}
				}
				currentPlaying = v;
			}
		};

		var getIndexById = function(id) {
			var arr = vm.songList(),
				l = arr.length,
				iReturn = -1;
			for (var i = 0; i < l; i++) {
				if (arr[i].id == id) {
					iReturn = i;
				}
			}
			return iReturn;
		};

		vm.playNext = function(id) {
			var iNext = getIndexById(id) + 1;
			if (iNext < vm.songList().length) {
				vm.songList()[iNext].play();
			}
		};

		vm.closeSong = function(v) {
			var iClose = getIndexById(v.id);
			vm.songList.splice(iClose, 1);
		};

		vm.toTop = function(v) {
			var iMove = getIndexById(v.id);
			if (iMove >= 1) {
				v.stop();
				var array = vm.songList();
				vm.songList.splice(iMove - 1, 2, array[iMove], array[iMove - 1]);
			}
		};
		vm.toBottom = function(v) {
			var iMove = getIndexById(v.id);
			var array = vm.songList(),
				l = array.length;
			if (iMove < (l - 1)) {
				v.stop();
				vm.songList.splice(iMove, 2, array[iMove + 1], array[iMove]);
			}
		};
		vm.clear = function() {
			if (currentPlaying !== null) {
				currentPlaying.stop();
			}
			current = null;
			vm.songList([]);
		};
		vm.isList = ko.computed(function() {
			return vm.songList().length > 0;
		});

		return vm;
	})();

	ko.applyBindings(playListVM, document.getElementById('playlist'));

	document.body.onkeyup = function(e) {
		if (e.keyCode == 32) {
			if (current !== null) {
				current.play();
			}
		}
	}

	// DRAG & DROP
	var $window = $(window),
		$body = $('body'),
		$dropZone = $('#drop-zone'),
		isDragOver = false;
	$window.on('dragover', function(e) {
			e.stopPropagation();
			e.preventDefault();
			e.originalEvent.dataTransfer.dropEffect = 'copy';
			if (!isDragOver && !loadingSong) {
				isDragOver = true;
				$body.addClass('dragover');
			}
		})
		.on('dragleave', function(e) {
			e.stopPropagation();
			e.preventDefault();
			if (!loadingSong) {
				isDragOver = false;
				$body.removeClass('dragover');
			}
		})
		.on('drop', function(e) {
			e.stopPropagation();
			e.preventDefault();

			if (!loadingSong) {
				isDragOver = false;
				$body.removeClass('dragover');
				playListVM.addSong(e);
			}
		});
};
jQuery(document).ready(function() {
	audioApp(jQuery);
});