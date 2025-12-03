// main.js — Fully fixed version

(function (global) {
  'use strict';

  let gl;

  const Main = {
    init: function () {

      // ---------------- Engine Init ----------------
      Engine.init({ canvasId: "overlay" });
      gl = Engine.gl;

      // ---------------- Modules Init ----------------
      Textures.uploadToGL();
      World.init();
      Player.init();

      // DELAY UI INIT BY **2 FRAMES**
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          UI.init();
        });
      });

      // ---------------- World Generation ----------------
      this._generateWorldAroundPlayer();

      // ---------------- Start Loop ----------------
      requestAnimationFrame(this.loop.bind(this));

      // Interaction
      this._handleBlockInteraction();
    },

    // ---------------- World Gen ----------------
    _generateWorldAroundPlayer: function () {
      const radius = 2;

      for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) {
          World.generateChunk(cx, cz);
          World.buildChunkMeshes(cx, cz);
        }
      }
    },

    // ---------------- Block Actions ----------------
    _handleBlockInteraction: function () {
      const canvas = document.getElementById("overlay");

      canvas.addEventListener("mousedown", (e) => {
        // BREAK
        if (e.button === 0) {
          const hit = Player.raycast(5);
          if (hit) {
            World.setBlock(hit.x, hit.y, hit.z, 0);
            const cx = Math.floor(hit.x / 16);
            const cz = Math.floor(hit.z / 16);
            World.buildChunkMeshes(cx, cz);
          }
        }

        // PLACE
        if (e.button === 2) {
          const hit = Player.raycast(5);
          if (hit) {
            const dir = Player.getDirection();
            const px = hit.x - Math.sign(dir[0]);
            const py = hit.y - Math.sign(dir[1]);
            const pz = hit.z - Math.sign(dir[2]);

            const blockId = UI.hotbarItems[UI.selectedBlock - 1];
            World.setBlock(px, py, pz, blockId);

            const cx = Math.floor(px / 16);
            const cz = Math.floor(pz / 16);
            World.buildChunkMeshes(cx, cz);
          }
        }
      });

      window.addEventListener("contextmenu", (e) => e.preventDefault());
    },

    // ---------------- Main Loop ----------------
    loop: function () {
      Player.update();
      this._renderWorld();

      // Draw UI ONLY if ready
      if (UI.ready) UI.render();

      requestAnimationFrame(this.loop.bind(this));
    },

    // ---------------- Rendering ----------------
    _renderWorld: function () {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const view = this._computeViewMatrix();

      Engine.useProgram("program3D");
      Engine.setViewMatrix("program3D", view);
      Engine.bindTextureToSampler("program3D", "uSampler", Textures.atlasTexture);

      for (const key in World.chunks) {
        const chunk = World.chunks[key];

        for (let s = 0; s < chunk.sections.length; s++) {
          const section = chunk.sections[s];
          if (!section.vertexBuffer) continue;

          gl.bindBuffer(gl.ARRAY_BUFFER, section.vertexBuffer);
          Engine.enableAttributes("program3D");

          gl.drawArrays(gl.TRIANGLES, 0, section.vertexCount);
        }
      }
    },

    // ---------------- View Matrix ----------------
    _computeViewMatrix: function () {
      const m = Engine.defaultView.slice();

      const sinY = Math.sin(Player.yaw);
      const cosY = Math.cos(Player.yaw);
      const sinP = Math.sin(Player.pitch);
      const cosP = Math.cos(Player.pitch);

      const px = Player.x;
      const py = Player.y + 1.6;
      const pz = Player.z;

      m[0] = cosY;  m[2] = -sinY;
      m[8] = sinY;  m[10] = cosY;

      m[5] = cosP;
      m[6] = sinP;
      m[9] = -sinP;
      m[10] = cosP;

      m[12] = -(px * m[0] + py * m[4] + pz * m[8]);
      m[13] = -(px * m[1] + py * m[5] + pz * m[9]);
      m[14] = -(px * m[2] + py * m[6] + pz * m[10]);

      return m;
    }
  };

  global.Main = Main;

  window.addEventListener("load", () => {
    Main.init();
  });

})(window);
