// Music player controller
(function(){
  const AUDIO_KEY = 'site_music_state'; // stores {index, time, enabled}
  // default playlist - change file names if you add different files
  const PLAYLIST = [
    'audio/song.mpeg',
    'audio/song2.mp3',
    'audio/song3.mp3'
  ];

  function createPlayerNode(){
    const container = document.createElement('div');
    container.id = 'music-player';

    // prev button
    const prev = document.createElement('button');
    prev.className = 'mp-btn mp-prev';
    prev.title = 'Previous';
    prev.innerHTML = `<span class="mp-icon">${prevSVG()}</span>`;

    // play/pause button
    const play = document.createElement('button');
    play.className = 'mp-btn mp-play';
    play.title = 'Play/Pause';
    play.innerHTML = `<span class="mp-icon">${playSVG()}</span>`;

    // next button
    const next = document.createElement('button');
    next.className = 'mp-btn mp-next';
    next.title = 'Next';
    next.innerHTML = `<span class="mp-icon">${nextSVG()}</span>`;

    const track = document.createElement('div');
    track.className = 'mp-track';
    track.textContent = '';

    const audio = document.createElement('audio');
    audio.id = 'site-background-audio';
    audio.loop = false; // we'll manage next track
    audio.preload = 'metadata';

    container.appendChild(prev);
    container.appendChild(play);
    container.appendChild(next);
    container.appendChild(track);
    container.appendChild(audio);

    return {container, prev, play, next, track, audio};
  }

  function playSVG(){ return `<!-- play -->\n<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`; }
  function pauseSVG(){ return `<!-- pause -->\n<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>`; }
  function prevSVG(){ return `<!-- prev -->\n<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 6v12l9-6zM19 6v12h-2V6z" fill="currentColor"/></svg>`; }
  function nextSVG(){ return `<!-- next -->\n<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 6v12l9-6zM20 6v12h-2V6z" fill="currentColor"/></svg>`; }

  function loadState(){ try{ const raw = localStorage.getItem(AUDIO_KEY); return raw? JSON.parse(raw): {index:0, time:0, enabled:false}; }catch(e){ return {index:0,time:0,enabled:false}; } }
  function saveState(s){ localStorage.setItem(AUDIO_KEY, JSON.stringify(s)); }

  function init(){
    const {container, prev, play, next, track, audio} = createPlayerNode();
    document.body.appendChild(container);

    let state = loadState();
    let idx = typeof state.index === 'number' ? state.index : 0;
    let isPlaying = false;

    async function validatePlaylist(){
      const okList = [];
      for(const url of PLAYLIST){
        try{
          const res = await fetch(url, { method: 'HEAD' });
          if(res && res.ok) okList.push(url);
        }catch(e){ /* ignore */ }
      }
      // if we found none, keep original first item as fallback
      if(okList.length) {
        PLAYLIST.length = 0; okList.forEach(u=>PLAYLIST.push(u));
      }
    }

    function setTrackUI(){
      const name = PLAYLIST[idx] ? PLAYLIST[idx].split('/').pop() : '';
      track.textContent = name;
      audio.src = PLAYLIST[idx] || '';
      audio.currentTime = state.time || 0;
    }

    function updatePlayIcon(){ play.innerHTML = `<span class="mp-icon">${isPlaying? pauseSVG(): playSVG()}</span>`; }

    prev.addEventListener('click', function(){
      idx = (idx - 1 + PLAYLIST.length) % PLAYLIST.length;
      state.index = idx; state.time = 0; state.enabled = true; saveState(state);
      setTrackUI();
      tryPlay(audio).then(ok=>{ isPlaying = ok; updatePlayIcon(); });
    });

    next.addEventListener('click', function(){
      idx = (idx + 1) % PLAYLIST.length;
      state.index = idx; state.time = 0; state.enabled = true; saveState(state);
      setTrackUI();
      tryPlay(audio).then(ok=>{ isPlaying = ok; updatePlayIcon(); });
    });

    play.addEventListener('click', async function(){
      if(audio.paused){
        const ok = await tryPlay(audio);
        if(ok){ isPlaying = true; state.enabled = true; saveState({...state, index: idx, time: Math.floor(audio.currentTime)}); }
      } else {
        audio.pause();
        isPlaying = false;
        state.enabled = false; state.time = Math.floor(audio.currentTime); saveState(state);
      }
      updatePlayIcon();
    });

    audio.addEventListener('timeupdate', function(){ state.time = Math.floor(audio.currentTime); saveState(state); });
    audio.addEventListener('pause', ()=>{ isPlaying = false; updatePlayIcon(); });
    audio.addEventListener('play', ()=>{ isPlaying = true; updatePlayIcon(); });
    audio.addEventListener('ended', function(){
      // auto next
      idx = (idx + 1) % PLAYLIST.length;
      state.index = idx; state.time = 0; saveState(state);
      setTrackUI();
      // slight delay to let src change
      setTimeout(()=> tryPlay(audio).then(ok=>{ isPlaying = ok; updatePlayIcon(); }), 160);
    });

    // validate playlist then init UI and try to resume
    validatePlaylist().then(()=>{
      // adjust idx if out of bounds
      if(idx >= PLAYLIST.length) idx = 0;
      setTrackUI(); updatePlayIcon();

      // if no playable tracks, disable controls
      if(!PLAYLIST.length){
        play.disabled = prev.disabled = next.disabled = true;
        track.textContent = 'No tracks';
        return;
      }

      // try to auto-resume if enabled
      if(state.enabled){ tryPlay(audio).then(ok=>{ isPlaying = ok; updatePlayIcon(); }); }
    });

    // expose API
    window.__siteMusic = {
      setPlaylist: function(list){ if(Array.isArray(list) && list.length){ PLAYLIST.length = 0; list.forEach(i=>PLAYLIST.push(i)); state.index = 0; saveState(state); setTrackUI(); } },
      setSrc: function(src){ PLAYLIST[0] = src; state.index = 0; saveState(state); setTrackUI(); },
      play: ()=> audio.play(),
      pause: ()=> audio.pause(),
      next: ()=> next.click(),
      prev: ()=> prev.click(),
      audioEl: audio
    };
  }

  async function tryPlay(audio){
    try{ await audio.play(); return true; }catch(e){ return false; }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
