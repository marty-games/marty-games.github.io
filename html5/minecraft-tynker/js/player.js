// js/player.js — Fixed for dual-canvas setup (uses glCanvas for pointer lock)

(function (global) {
  'use strict';

  const Player = {
    x: 0,
    y: 40,
    z: 0,

    velX: 0,
    velY: 0,
    velZ: 0,

    yaw: 0,
    pitch: 0,

    speed: 0.12,
    sensitivity: 0.002,
    gravity: -0.01,
    jumpForce: 0.22,

    onGround: false,
    input: { w:false, a:false, s:false, d:false, space:false },

    _mouseMoveHandler: null, // will store the bound handler

    init: function () {
      // Attach input handlers and pointer lock
      this._setupInput();
      this._setupPointerLock();
    },

    /* ---------------------------------------------------------
       Input setup
    --------------------------------------------------------- */
    _setupInput: function () {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') this.input.w = true;
        if (e.code === 'KeyS') this.input.s = true;
        if (e.code === 'KeyA') this.input.a = true;
        if (e.code === 'KeyD') this.input.d = true;
        if (e.code === 'Space') this.input.space = true;
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') this.input.w = false;
        if (e.code === 'KeyS') this.input.s = false;
        if (e.code === 'KeyA') this.input.a = false;
        if (e.code === 'KeyD') this.input.d = false;
        if (e.code === 'Space') this.input.space = false;
      });
    },

    /* ---------------------------------------------------------
       Mouse look / pointer lock (uses glCanvas)
    --------------------------------------------------------- */
    _setupPointerLock: function () {
      const canvas = document.getElementById('glCanvas');
      if (!canvas) {
        console.error('Player.init ERROR: glCanvas not found. Pointer lock disabled.');
        return;
      }

      // bind here so we can remove later
      this._mouseMoveHandler = this._mouseMove.bind(this);

      // Request pointer lock on click
      canvas.addEventListener('click', () => {
        if (canvas.requestPointerLock) canvas.requestPointerLock();
      });

      // pointerlockchange handler
      document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
          document.addEventListener('mousemove', this._mouseMoveHandler);
        } else {
          document.removeEventListener('mousemove', this._mouseMoveHandler);
        }
      });
    },

    _mouseMove: function (e) {
      // Use small sanity checks if movementX/Y undefined (older browsers)
      const movX = (typeof e.movementX === 'number') ? e.movementX : (e.mozMovementX || e.webkitMovementX || 0);
      const movY = (typeof e.movementY === 'number') ? e.movementY : (e.mozMovementY || e.webkitMovementY || 0);

      Player.yaw   -= movX * Player.sensitivity;
      Player.pitch -= movY * Player.sensitivity;

      // clamp pitch
      const limit = Math.PI / 2 - 0.01;
      if (Player.pitch > limit) Player.pitch = limit;
      if (Player.pitch < -limit) Player.pitch = -limit;
    },

    /* ---------------------------------------------------------
       Movement update
    --------------------------------------------------------- */
    update: function () {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);

      let mx = 0;
      let mz = 0;

      if (this.input.w) { mx += sin; mz += cos; }
      if (this.input.s) { mx -= sin; mz -= cos; }
      if (this.input.a) { mx -= cos; mz += sin; }
      if (this.input.d) { mx += cos; mz -= sin; }

      // normalize diagonal
      const mag = Math.sqrt(mx*mx + mz*mz);
      if (mag > 0) {
        mx /= mag;
        mz /= mag;
      }

      this.velX = mx * this.speed;
      this.velZ = mz * this.speed;

      // gravity
      this.velY += this.gravity;

      // jump
      if (this.onGround && this.input.space) {
        this.velY = this.jumpForce;
        this.onGround = false;
      }

      // apply movement with collision
      this._moveWithCollision();
    },

    /* ---------------------------------------------------------
       Basic collision system
    --------------------------------------------------------- */
    _moveWithCollision: function () {
      if (!global.World) return;

      let newX = this.x + this.velX;
      let newY = this.y + this.velY;
      let newZ = this.z + this.velZ;

      const feetY = Math.floor(newY);
      const headY  = Math.floor(newY + 1.7);

      // Check simple collisions along each axis
      // X axis
      const blockAtNewX = World.getBlock(Math.floor(newX), Math.floor(this.y), Math.floor(this.z));
      if (blockAtNewX === 0) {
        this.x = newX;
      } else {
        this.velX = 0;
      }

      // Z axis
      const blockAtNewZ = World.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(newZ));
      if (blockAtNewZ === 0) {
        this.z = newZ;
      } else {
        this.velZ = 0;
      }

      // Y axis (vertical)
      const blockBelow = World.getBlock(Math.floor(this.x), Math.floor(newY), Math.floor(this.z));
      const blockAbove = World.getBlock(Math.floor(this.x), Math.floor(newY + 1.7), Math.floor(this.z));

      if (blockBelow === 0 && blockAbove === 0) {
        this.y = newY;
        this.onGround = false;
      } else {
        // landed or hit ceiling
        if (this.velY < 0) {
          this.onGround = true;
        }
        this.velY = 0;
      }
    },

    /* ---------------------------------------------------------
       Camera direction
    --------------------------------------------------------- */
    getDirection: function () {
      const dx = Math.cos(this.pitch) * Math.sin(this.yaw);
      const dy = Math.sin(this.pitch);
      const dz = Math.cos(this.pitch) * Math.cos(this.yaw);
      return [dx, dy, dz];
    },

    /* ---------------------------------------------------------
       Raycast
    --------------------------------------------------------- */
    raycast: function (maxDist = 5.0) {
      const [dx, dy, dz] = this.getDirection();

      let x = this.x;
      let y = this.y + 1.6; // camera height
      let z = this.z;

      const step = 0.1;
      const steps = Math.floor(maxDist / step) * 10;

      for (let i = 0; i < steps; i++) {
        x += dx * step;
        y += dy * step;
        z += dz * step;

        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);

        const block = World.getBlock(bx, by, bz);
        if (block !== 0) {
          return { x: bx, y: by, z: bz, id: block };
        }
      }
      return null;
    }
  };

  global.Player = Player;

})(window);
