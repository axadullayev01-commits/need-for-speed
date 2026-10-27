/**
 * Handles keyboard and user input for vehicle control.
 */
export class InputManager {
  constructor(onActionCallback) {
    this.keys = {};
    this.onAction = onActionCallback || (() => {});

    // Bind event listeners
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.resetKeys());
  }

  onKeyDown(e) {
    // Ignore key presses if user is typing in an input field
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    this.keys[e.code] = true;

    // Single trigger actions
    if (e.code === 'KeyR' && !e.repeat) {
      this.onAction('reset');
    } else if (e.code === 'KeyC' && !e.repeat) {
      this.onAction('camera_toggle');
    } else if (e.code === 'KeyM' && !e.repeat) {
      this.onAction('mute_toggle');
    }

    // Prevent default scroll actions for arrows and space
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  resetKeys() {
    this.keys = {};
  }

  /**
   * Samples current continuous vehicle control inputs
   * Returns: { throttle, steer, brake, handbrake }
   */
  sampleInput() {
    let throttle = 0;
    let brake = 0;
    let steer = 0;

    // Throttle (Forward)
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      throttle += 1.0;
    }

    // Reverse / Brake
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      throttle -= 1.0;
      brake = 0.8;
    }

    // Steering (A / Left Arrow turns Left, D / Right Arrow turns Right)
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      steer += 1.0; // Left
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      steer -= 1.0; // Right
    }

    // Handbrake
    const handbrake = Boolean(this.keys['Space']);

    return {
      throttle,
      steer,
      brake,
      handbrake
    };
  }
}
