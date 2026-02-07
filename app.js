// TOEIC Practice App with TTS
class TOEICApp {
  constructor() {
    this.currentView = 'home';
    this.currentPart = null;
    this.currentQuestions = [];
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.calendarDate = new Date();
    this.synth = window.speechSynthesis;
    this.isSpeaking = false;
    this.speechRate = 0.9;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStats();
    this.updateStatsDisplay();
  }

  bindEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    document.querySelectorAll('.part-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const part = e.currentTarget.dataset.part;
        this.startPractice(parseInt(part));
      });
    });

    document.getElementById('back-to-home').addEventListener('click', () => {
      if (confirm('確定要離開嗎？練習進度將不會保存。')) {
        this.stopSpeaking();
        this.switchView('home');
      }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      this.stopSpeaking();
      this.nextQuestion();
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      this.startPractice(this.currentPart);
    });

    document.getElementById('btn-home').addEventListener('click', () => {
      this.switchView('home');
    });

    document.getElementById('prev-month').addEventListener('click', () => {
      this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
      this.renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
      this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
      this.renderCalendar();
    });
  }

  isAudioPart(part) {
    return [1, 2, 3, 4].includes(part);
  }

  getTextToSpeak(question) {
    let text = '';
    
    if (this.currentPart === 1) {
      text = question.context.replace(/\[照片：|]/g, '') + '. ';
      text += 'Question: ' + question.question + '. ';
      const letters = ['A', 'B', 'C', 'D'];
      question.options.forEach((opt, i) => {
        text += letters[i] + '. ' + opt + '. ';
      });
    }
    else if ([2, 3, 4].includes(this.currentPart)) {
      if (question.context) {
        text = question.context.replace(/W:|M:/g, '').replace(/\n/g, ' ') + '. ';
      }
      text += 'Question: ' + question.question + '. ';
      const letters = ['A', 'B', 'C'];
      if (question.options.length === 4) letters.push('D');
      question.options.forEach((opt, i) => {
        text += letters[i] + '. ' + opt + '. ';
      });
    }
    
    return text;
  }

  speak(text) {
    if (!this.synth) return;
    this.stopSpeaking();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = this.speechRate;
    utterance.pitch = 1;
    
    const voices = this.synth.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google')) ||
                         voices.find(v => v.lang.includes('en-US')) ||
                         voices.find(v => v.lang.includes('en'));
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onstart = () => { this.isSpeaking = true; this.updatePlayButton(true); };
    utterance.onend = () => { this.isSpeaking = false; this.updatePlayButton(false); };
    utterance.onerror = () => { this.isSpeaking = false; this.updatePlayButton(false); };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.updatePlayButton(false);
    }
  }

  updatePlayButton(isPlaying) {
    const btn = document.getElementById('btn-play-audio');
    const status = document.getElementById('audio-status');
    if (btn) {
      btn.classList.toggle('playing', isPlaying);
      btn.innerHTML = isPlaying ? '⏹' : '▶';
    }
    if (status) {
      status.textContent = isPlaying ? '播放中...' : '點擊播放';
      status.classList.toggle('playing', isPlaying);
    }
  }

  switchView(view) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${view}-view`).classList.add('active');
    this.currentView = view;
    if (view === 'calendar') this.renderCalendar();
    if (view === 'home') this.updateStatsDisplay();
  }

  startPractice(part) {
    this.currentPart = part;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.stopSpeaking();

    const allQuestions = questionBank[part] || [];
    const today = this.getDateString(new Date());
    const history = this.getHistory();
    const todayPracticed = new Set();
    
    if (history[today]) {
      history[today].forEach(session => {
        if (session.part === part) {
          session.questions.forEach(q => todayPracticed.add(q.id));
        }
      });
    }

    const availableQuestions = allQuestions.filter(q => !todayPracticed.has(q.id));

    if (availableQuestions.length < 10) {
      alert(`今天已經練習完這個Part的大部分題目了！\n可用題目: ${availableQuestions.length}題\n明天會重置喔～`);
      if (availableQuestions.length === 0) return;
    }

    this.currentQuestions = this.shuffleArray(availableQuestions).slice(0, 10);
    this.switchView('practice');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    this.renderQuestion();
  }

  renderQuestion() {
    const question = this.currentQuestions[this.currentQuestionIndex];
    const questionArea = document.getElementById('question-area');
    const feedbackArea = document.getElementById('feedback-area');
    const btnNext = document.getElementById('btn-next');

    document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = this.currentQuestions.length;
    document.getElementById('progress-fill').style.width = 
      `${((this.currentQuestionIndex + 1) / this.currentQuestions.length) * 100}%`;

    feedbackArea.style.display = 'none';
    btnNext.style.display = 'none';

    let html = `<span class="question-type">${question.type}</span>`;
    
    if (this.isAudioPart(this.currentPart)) {
      html += `
        <div class="audio-player">
          <button class="btn-play" id="btn-play-audio">▶</button>
          <div class="audio-info">
            <div class="audio-label">🔊 聽力題目</div>
            <div class="audio-status" id="audio-status">點擊播放</div>
          </div>
          <div class="speed-control">
            <label>速度:</label>
            <select id="speech-rate">
              <option value="0.7">慢速</option>
              <option value="0.9" selected>正常</option>
              <option value="1.1">快速</option>
            </select>
          </div>
        </div>
      `;
      html += `<p class="question-text" style="color: var(--text-secondary); font-style: italic; text-align: center;">🎧 請點擊播放按鈕聽題目後作答</p>`;
    } else {
      if (question.context) {
        html += `<div class="question-context">${question.context.replace(/\n/g, '<br>')}</div>`;
      }
      html += `<p class="question-text">${question.question}</p>`;
    }

    html += '<div class="options">';
    const letters = ['A', 'B', 'C', 'D'];
    question.options.forEach((option, index) => {
      html += `
        <div class="option" data-index="${index}">
          <span class="option-letter">${letters[index]}</span>
          <span class="option-text">${option}</span>
        </div>
      `;
    });
    html += '</div>';
    questionArea.innerHTML = html;

    if (this.isAudioPart(this.currentPart)) {
      const playBtn = document.getElementById('btn-play-audio');
      const rateSelect = document.getElementById('speech-rate');
      
      playBtn.addEventListener('click', () => {
        if (this.isSpeaking) {
          this.stopSpeaking();
        } else {
          this.speak(this.getTextToSpeak(question));
        }
      });
      
      rateSelect.addEventListener('change', (e) => {
        this.speechRate = parseFloat(e.target.value);
      });
    }

    document.querySelectorAll('.option').forEach(option => {
      option.addEventListener('click', (e) => {
        this.selectAnswer(parseInt(e.currentTarget.dataset.index));
      });
    });
  }

  selectAnswer(selectedIndex) {
    const question = this.currentQuestions[this.currentQuestionIndex];
    const isCorrect = selectedIndex === question.answer;
    
    this.stopSpeaking();
    
    this.answers.push({
      questionId: question.id,
      selected: selectedIndex,
      correct: question.answer,
      isCorrect: isCorrect
    });

    document.querySelectorAll('.option').forEach((option, index) => {
      option.style.pointerEvents = 'none';
      if (index === selectedIndex && !isCorrect) option.classList.add('wrong');
      if (index === question.answer) option.classList.add('correct');
    });

    const feedbackArea = document.getElementById('feedback-area');
    const letters = ['A', 'B', 'C', 'D'];
    
    // 顯示原文（聽力題）
    let transcriptHtml = '';
    if (this.isAudioPart(this.currentPart)) {
      transcriptHtml = `
        <div style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #22c55e;">
          <strong style="color: #22c55e;">📝 聽力原文：</strong><br><br>
          <span style="color: var(--text-secondary); line-height: 1.8;">${question.context ? question.context.replace(/\n/g, '<br>') : ''}</span>
        </div>
        <div style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #6366f1;">
          <strong style="color: #6366f1;">❓ 題目：</strong><br><br>
          <span style="color: var(--text-primary);">${question.question}</span>
        </div>
      `;
    }

    // 顯示中文翻譯（所有Part）
    let translationHtml = '';
    if (question.translation) {
      translationHtml = `
        <div style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #f59e0b;">
          <strong style="color: #f59e0b;">🔤 中文翻譯：</strong><br><br>
          <span style="color: var(--text-secondary); line-height: 1.8;">${question.translation.replace(/\n/g, '<br>')}</span>
        </div>
      `;
    }
    
    feedbackArea.innerHTML = `
      <div class="feedback-header ${isCorrect ? 'correct' : 'wrong'}">
        ${isCorrect ? '✓ 正確！' : '✗ 錯誤'}
      </div>
      ${transcriptHtml}
      ${translationHtml}
      <div class="feedback-explanation">
        <strong>正確答案：${letters[question.answer]}</strong><br><br>
        ${question.explanation}
      </div>
    `;
    feedbackArea.style.display = 'block';

    document.getElementById('btn-next').style.display = 'inline-block';
    document.getElementById('btn-next').textContent = 
      this.currentQuestionIndex < this.currentQuestions.length - 1 ? '下一題 →' : '查看結果';
  }

  nextQuestion() {
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex >= this.currentQuestions.length) {
      this.showResults();
    } else {
      this.renderQuestion();
    }
  }

  showResults() {
    const correctCount = this.answers.filter(a => a.isCorrect).length;
    const totalQuestions = this.answers.length;
    this.saveSession();

    document.getElementById('practice-view').classList.remove('active');
    document.getElementById('results-view').classList.add('active');
    document.getElementById('final-score').textContent = correctCount;
    
    const percentage = (correctCount / totalQuestions) * 100;
    let message = '';
    if (percentage === 100) message = '太棒了！完美表現！🎉';
    else if (percentage >= 80) message = '很好！繼續保持！👍';
    else if (percentage >= 60) message = '還不錯，再接再厲！💪';
    else message = '需要多練習，加油！📚';
    
    document.getElementById('score-message').textContent = message;

    const detailHtml = this.answers.map((answer, index) => {
      const question = this.currentQuestions[index];
      const letters = ['A', 'B', 'C', 'D'];
      
      return `
        <div class="result-item">
          <div class="result-item-header">
            <span class="result-status ${answer.isCorrect ? 'correct' : 'wrong'}">
              ${answer.isCorrect ? '✓' : '✗'}
            </span>
            <span>第 ${index + 1} 題</span>
          </div>
          <p class="result-question">${question.question}</p>
          ${!answer.isCorrect ? `
            <p class="result-answer">
              你的答案：<span class="your-answer">${letters[answer.selected]}. ${question.options[answer.selected]}</span><br>
              正確答案：<span class="correct-answer">${letters[answer.correct]}. ${question.options[answer.correct]}</span>
            </p>
          ` : ''}
          <div class="result-explanation">💡 ${question.explanation}</div>
        </div>
      `;
    }).join('');

    document.getElementById('results-detail').innerHTML = detailHtml;
  }

  renderCalendar() {
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('calendar-title').textContent = `${year}年 ${months[month]}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const history = this.getHistory();
    const today = new Date();
    const todayString = this.getDateString(today);

    let html = '';
    
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month">${prevMonth.getDate() - i}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = this.getDateString(new Date(year, month, day));
      const hasPractice = history[dateString] && history[dateString].length > 0;
      const isToday = dateString === todayString;
      html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasPractice ? 'has-practice' : ''}" data-date="${dateString}">${day}</div>`;
    }

    const remainingDays = 42 - (startDay + daysInMonth);
    for (let i = 1; i <= remainingDays; i++) {
      html += `<div class="cal-day other-month">${i}</div>`;
    }

    document.getElementById('calendar-days').innerHTML = html;

    document.querySelectorAll('.cal-day:not(.other-month)').forEach(day => {
      day.addEventListener('click', (e) => this.showDayReview(e.target.dataset.date));
    });
  }

  showDayReview(dateString) {
    const history = this.getHistory();
    const sessions = history[dateString] || [];
    const reviewPanel = document.getElementById('review-panel');
    const reviewContent = document.getElementById('review-content');

    const date = new Date(dateString);
    document.getElementById('review-date').textContent = `${date.getMonth() + 1}月${date.getDate()}日`;

    if (sessions.length === 0) {
      reviewContent.innerHTML = '<p style="color: var(--text-secondary);">這天沒有練習紀錄</p>';
    } else {
      const partNames = {1:'Part 1 照片描述',2:'Part 2 應答問題',3:'Part 3 簡短對話',4:'Part 4 簡短獨白',5:'Part 5 句子填空',6:'Part 6 段落填空',7:'Part 7 閱讀理解'};
      reviewContent.innerHTML = sessions.map((session, index) => {
        const correctCount = session.questions.filter(q => q.isCorrect).length;
        return `
          <div class="review-session">
            <div class="review-session-header">
              <span class="review-session-part">${partNames[session.part]}</span>
              <span class="review-session-score">${correctCount}/${session.questions.length} 正確</span>
            </div>
            <button class="review-btn" data-date="${dateString}" data-index="${index}">複習這次練習</button>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.startReview(e.target.dataset.date, parseInt(e.target.dataset.index)));
      });
    }
    reviewPanel.style.display = 'block';
  }

  startReview(dateString, sessionIndex) {
    const session = this.getHistory()[dateString][sessionIndex];
    const allQuestions = questionBank[session.part];
    this.currentQuestions = session.questions.map(q => allQuestions.find(orig => orig.id === q.id)).filter(q => q);
    if (this.currentQuestions.length === 0) { alert('找不到題目資料'); return; }
    this.currentPart = session.part;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.switchView('practice');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    this.renderQuestion();
  }

  getHistory() { return JSON.parse(localStorage.getItem('toeic-history') || '{}'); }

  saveSession() {
    const history = this.getHistory();
    const today = this.getDateString(new Date());
    if (!history[today]) history[today] = [];
    history[today].push({
      part: this.currentPart,
      timestamp: Date.now(),
      questions: this.answers.map((answer, index) => ({ id: this.currentQuestions[index].id, isCorrect: answer.isCorrect }))
    });
    localStorage.setItem('toeic-history', JSON.stringify(history));
    this.updateStatsDisplay();
  }

  loadStats() {
    const history = this.getHistory();
    let totalPracticed = 0, totalCorrect = 0;
    Object.values(history).forEach(day => day.forEach(session => session.questions.forEach(q => { totalPracticed++; if (q.isCorrect) totalCorrect++; })));
    return { totalPracticed, accuracy: totalPracticed > 0 ? Math.round((totalCorrect / totalPracticed) * 100) : 0, streakDays: this.calculateStreak(history) };
  }

  calculateStreak(history) {
    const dates = Object.keys(history).sort().reverse();
    if (dates.length === 0) return 0;
    const today = this.getDateString(new Date());
    const yesterday = this.getDateString(new Date(Date.now() - 86400000));
    if (dates[0] !== today && dates[0] !== yesterday) return 0;
    let streak = 0;
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i - (dates[0] === yesterday ? 1 : 0));
      if (dates[i] === this.getDateString(expectedDate)) streak++; else break;
    }
    return streak;
  }

  updateStatsDisplay() {
    const stats = this.loadStats();
    document.getElementById('total-practiced').textContent = stats.totalPracticed;
    document.getElementById('total-correct').textContent = stats.accuracy + '%';
    document.getElementById('streak-days').textContent = stats.streakDays;
  }

  getDateString(date) { return date.toISOString().split('T')[0]; }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new TOEICApp(); });

