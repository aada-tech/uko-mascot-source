// <uko-mascot state="idle" hair="dreadlocks" brand="#FFFFFF" hair-color="#0B0B0B" theme="auto|system|light|dark"
//             contrast="direct|auto" interactive="true|false" walk="true|false"
//             one-shot="return|loop" cheeks="true|false" character="uko|aituko|meowuko" accent="#FFC93C"
//             follow="hover|page|none">
if (typeof customElements !== 'undefined' && !customElements.get('uko-mascot')) {
  class UkoMascotElement extends HTMLElement {
    static get observedAttributes() {
      return ['state', 'brand', 'hair', 'hair-color', 'contrast', 'interactive', 'walk', 'one-shot', 'cheeks', 'theme', 'character', 'accent', 'follow'];
    }
    connectedCallback() {
      if (!this.style.display) this.style.display = 'block';
      this.mascot = createUkoMascot(this, {
        state: this.getAttribute('state') || 'idle',
        brandColor: this.getAttribute('brand') || '#FFFFFF',
        hairStyle: this.getAttribute('hair') || 'dreadlocks',
        hairColor: this.getAttribute('hair-color') || '#0B0B0B',
        contrastMode: this.getAttribute('contrast') || 'auto',
        theme: this.getAttribute('theme') || 'auto',
        interactive: this.getAttribute('interactive') !== 'false',
        oneShotMode: this.getAttribute('one-shot') || 'return',
        cheeks: this.getAttribute('cheeks') !== 'false',
        character: this.getAttribute('character') || 'uko',
        accentColor: this.getAttribute('accent') || '#FFC93C',
        follow: this.getAttribute('follow') || 'hover',
        onStateChange: state => this.dispatchEvent(new CustomEvent('statechange', { detail: { state } })),
        onComplete: state => this.dispatchEvent(new CustomEvent('complete', { detail: { state } })),
        onTap: detail => this.dispatchEvent(new CustomEvent('tap', { detail }))
      });
      if (this.getAttribute('walk') === 'true') this.mascot.startWalk();
    }
    disconnectedCallback() {
      if (this.mascot) { this.mascot.destroy(); this.mascot = null; }
    }
    attributeChangedCallback(name, oldVal, newVal) {
      if (!this.mascot || oldVal === newVal) return;
      if (name === 'state') this.mascot.setState(newVal);
      else if (name === 'brand') this.mascot.setBrandColor(newVal);
      else if (name === 'hair') this.mascot.setHairStyle(newVal);
      else if (name === 'hair-color') this.mascot.setHairColor(newVal);
      else if (name === 'contrast') this.mascot.setContrastMode(newVal);
      else if (name === 'interactive') this.mascot.setInteractive(newVal !== 'false');
      else if (name === 'one-shot') this.mascot.setOneShotMode(newVal);
      else if (name === 'cheeks') this.mascot.setCheeks(newVal !== 'false');
      else if (name === 'theme') this.mascot.setTheme(newVal);
      else if (name === 'character') this.mascot.setCharacter(newVal);
      else if (name === 'accent') this.mascot.setAccentColor(newVal);
      else if (name === 'follow') this.mascot.setFollow(newVal);
      else if (name === 'walk') newVal === 'true' ? this.mascot.startWalk() : this.mascot.stopWalk();
    }
  }
  customElements.define('uko-mascot', UkoMascotElement);
}
