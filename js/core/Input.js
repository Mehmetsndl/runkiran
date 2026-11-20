// Fare (hareket) ve klavye (yazma) girdileri
import * as THREE from 'three';

export class Input {
  constructor(game) {
    this.game = game;
    const canvas = game.sceneMgr.renderer.domElement;

    this.ndc = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.groundPoint = new THREE.Vector3();
    this.hasPointer = false;
    this.mouseDown = false;

    canvas.addEventListener('pointermove', (e) => this._onMove(e));
    canvas.addEventListener('pointerdown', (e) => {
      this._onMove(e);
      if (e.button === 0) this.mouseDown = true;
      else if (e.button === 2) game.toggleMoveMode();
    });
    window.addEventListener('pointerup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('pointerleave', () => { this.hasPointer = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.mouseDown = false; this.hasPointer = false; });
    window.addEventListener('keydown', (e) => game.onKeyDown(e));
  }

  _onMove(e) {
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.hasPointer = true;
  }

  /** Kamera her kare hareket ettiği için zemin noktasını her kare yeniden hesapla */
  update() {
    this.raycaster.setFromCamera(this.ndc, this.game.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.groundPoint);
  }
}
