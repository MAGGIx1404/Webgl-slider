console.clear();

let nMouse = new THREE.Vector2();
window.addEventListener("mousemove", (event) => {
  event.preventDefault();
  nMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  nMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

let mouseOver = false,
  mouseDown = false;

const vertexShader = document.getElementById("vertexShader").innerHTML;
const fragmentShader = document.getElementById("fragmentShader").innerHTML;

const planeGeometry = new THREE.PlaneBufferGeometry(1, 1, 32, 32);
const planeMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
});

// -------- UTILITY FUNCTIONS & CLASSES [START] --------

const lerp = (a, b, n) => (1 - n) * a + n * b;

const getMousePos = (e) => {
  let posx = 0;
  let posy = 0;
  if (!e) e = window.event;
  if (e.pageX || e.pageY) {
    posx = e.pageX;
    posy = e.pageY;
  } else if (e.clientX || e.clientY) {
    posx = e.clientX + body.scrollLeft + document.documentElement.scrollLeft;
    posy = e.clientY + body.scrollTop + document.documentElement.scrollTop;
  }

  return { x: posx, y: posy };
};

function preloadImages(selector) {
  return new Promise((resolve, reject) => {
    imagesLoaded(selector, { background: true }, resolve);
  });
}

class Mouse {
  constructor() {
    this.position = {
      x: 0,
      y: 0,
    };
    this.isMoving = false;

    this.mouseEvent = {
      previous: null,
      current: null,
    };

    this.initEvents();
    this.updateMovingState();
  }
  initEvents() {
    window.addEventListener("mousemove", (ev) => {
      this.mouseEvent.current = ev;
      this.position = getMousePos(ev);
    });
  }
  updateMovingState() {
    setInterval(() => {
      if (this.mouseEvent.previous && this.mouseEvent.current) {
        const moveX = Math.abs(
          this.mouseEvent.current.screenX - this.mouseEvent.previous.screenX
        );
        const moveY = Math.abs(
          this.mouseEvent.current.screenY - this.mouseEvent.previous.screenY
        );
        const movement = Math.sqrt(moveX * moveX + moveY * moveY);

        if (movement == 0) this.isMoving = false;
        else this.isMoving = true;
      }

      this.mouseEvent.previous = this.mouseEvent.current;
    }, 100);
  }
}

class Splitter {
  constructor(el) {
    this.DOM = { el };
    this.DOMElComputedStyles = getComputedStyle(this.DOM.el);

    this.init();
  }

  init() {
    const lines = this.split();
    this.clearElement();
    this.insertLines(lines);
  }

  split() {
    const maxwidth = this.DOM.el.getBoundingClientRect().width;
    const textContent = this.DOM.el.innerText;
    const words = textContent.split(" ");

    const lines = [];
    let curline = [];

    const fontWeight = this.DOMElComputedStyles["font-weight"];
    const fontSize = this.DOMElComputedStyles["font-size"];
    const fontFamily = this.DOMElComputedStyles["font-family"];

    const canvasEl = document.createElement("canvas");
    const ghost =
      "OffscreenCanvas" in window
        ? canvasEl.transferControlToOffscreen()
        : canvasEl;
    const context = ghost.getContext("2d");

    context.font = `${fontWeight} ${fontSize} ${fontFamily}`;

    for (let i = 0; i < words.length; i++) {
      curline.push(words[i]);
      if (context.measureText(curline.join(" ")).width >= maxwidth) {
        const cache = curline.pop();
        lines.push(curline.join(" "));
        curline = [cache];
      }
    }
    lines.push(curline.join(" "));
    return lines;
  }

  insertLines(lines) {
    this.linesEl = document.createElement("span");
    this.linesEl.className = "lines";
    this.linesEl.style.display = "block";

    lines.forEach((line) => {
      const lineEl = document.createElement("span");
      const lineInnerTextEl = document.createElement("span");

      lineEl.className = "line";
      lineInnerTextEl.className = "line--innertext";

      lineEl.style.display = "block";
      lineInnerTextEl.style.display = "block";

      lineInnerTextEl.innerText = line;

      lineEl.appendChild(lineInnerTextEl);
      this.linesEl.appendChild(lineEl);
    });

    this.DOM.el.appendChild(this.linesEl);
  }

  clearElement() {
    this.DOM.el.innerHTML = "";
  }
}

// -------- UTILITY FUNCTIONS & CLASSES [END] --------

// -------- GL CLASSES [START] --------

class GL {
  constructor() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.z = 50;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(
      gsap.utils.clamp(1.5, 1, window.devicePixelRatio)
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0xf2f2f2, 0);

    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    this.addToDom();
    this.addEvents();
    this.run();
  }

  addToDom() {
    const canvas = this.renderer.domElement;
    canvas.classList.add("dom-gl");
    document.body.appendChild(canvas);
  }

  addEvents() {
    window.addEventListener("resize", this.resize.bind(this));
    requestAnimationFrame(() => this.run());
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.updateProjectionMatrix();

    for (let i = 0; i < this.scene.children.length; i++) {
      const plane = this.scene.children[i];
      if (plane.resize) plane.resize();
    }
  }

  run() {
    let elapsed = this.clock.getElapsedTime();

    for (let i = 0; i < this.scene.children.length; i++) {
      const plane = this.scene.children[i];
      if (plane.updateTime) plane.updateTime(elapsed);
    }

    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.run());
  }
}

const Gl = new GL();

class GlObject extends THREE.Object3D {
  init(el) {
    this.el = el;
    this.resize();
  }

  resize() {
    this.setBounds();
  }

  setBounds() {
    this.rect = this.el.getBoundingClientRect();

    this.bounds = {
      left: this.rect.left,
      top: this.rect.top + window.scrollY,
      width: this.rect.width,
      height: this.rect.height,
    };

    this.updateSize();
    this.updatePosition();
  }

  updateSize() {
    this.camUnit = this.calculateUnitSize(
      Gl.camera.position.z - this.position.z
    );

    const x = this.bounds.width / window.innerWidth;
    const y = this.bounds.height / window.innerHeight;

    if (!x || !y) return;

    this.scale.x = this.camUnit.width * x;
    this.scale.y = this.camUnit.height * y;
  }

  calculateUnitSize(distance = this.position.z) {
    const vFov = (Gl.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * distance;
    const width = height * Gl.camera.aspect;

    return { width, height };
  }

  updateY(y = 0) {
    const { top, height } = this.bounds;

    this.position.y = this.camUnit.height / 2 - this.scale.y / 2;
    this.position.y -= ((top - y) / window.innerHeight) * this.camUnit.height;

    this.progress = gsap.utils.clamp(
      0,
      1,
      1 - (-y + top + height) / (window.innerHeight + height)
    );
  }

  updateX(x = 0) {
    const { left } = this.bounds;

    this.position.x = -(this.camUnit.width / 2) + this.scale.x / 2;
    this.position.x += ((left + x) / window.innerWidth) * this.camUnit.width;
  }

  updatePosition(y) {
    this.updateY(y);
    this.updateX(0);
  }
}

class GlSlider extends GlObject {
  init(el) {
    super.init(el);

    this.geometry = planeGeometry;
    this.material = planeMaterial.clone();

    this.material.uniforms = {
      uCurrTex: { value: 0 },
      uNextTex: { value: 0 },
      uTime: { value: 0 },
      uProg: { value: 0 },
      uAmplitude: { value: 0 },
      uProgDirection: { value: 0 },
      uMeshSize: { value: [this.rect.width, this.rect.height] },
      uImageSize: { value: [0, 0] },
      uMousePos: { value: [0, 0] },
      uMouseOverAmp: { value: 0 },
      uAnimating: { value: false },
      uRadius: { value: 0.08 },
      uTranslating: { value: true },
    };

    this.imageScale = 1;

    this.textures = [];

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mouseLerpAmount = 0.1;

    this.state = {
      animating: false,
      current: 0,
    };

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.add(this.mesh);

    Gl.scene.add(this);

    this.loadTextures();
    this.addEvents();
  }

  loadTextures() {
    const manager = new THREE.LoadingManager(() => {
      this.material.uniforms.uCurrTex.value = this.textures[0];
    });
    const loader = new THREE.TextureLoader(manager);
    const imgs = [...this.el.querySelectorAll("img")];

    imgs.forEach((img) => {
      loader.load(img.src, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        this.material.uniforms.uImageSize.value = [
          img.naturalWidth,
          img.naturalHeight,
        ];
        this.textures.push(texture);
      });
    });
  }

  switchTextures(index, direction) {
    if (this.state.animating) return;

    gsap
      .timeline({
        onStart: () => {
          this.state.animating = true;
          this.material.uniforms.uAnimating.value = true;
          this.material.uniforms.uProgDirection.value = direction;
          this.material.uniforms.uNextTex.value = this.textures[index];
        },
        onComplete: () => {
          this.state.animating = false;
          this.material.uniforms.uAnimating.value = false;
          this.material.uniforms.uCurrTex.value = this.textures[index];
          this.currentAmp = 0;
        },
      })
      .fromTo(
        this.material.uniforms.uProg,
        {
          value: 0,
        },
        {
          value: 1,
          duration: 1,
          ease: "ease.out",
        },
        0
      )
      .fromTo(
        this.material.uniforms.uAmplitude,
        {
          value: 0,
        },
        {
          duration: 0.8,
          value: 1,
          repeat: 1,
          yoyo: true,
          yoyoEase: "sine.out",
          ease: "expo.out",
        },
        0
      );
  }

  updateTime(time) {
    this.material.uniforms.uTime.value = time;
    this.run();
  }

  addEvents() {
    this.el.addEventListener("mouseenter", () => (mouseOver = true));
    this.el.addEventListener("mouseleave", () => (mouseOver = false));
    this.el.addEventListener("mousedown", () => (mouseDown = true));
    this.el.addEventListener("mouseup", () => (mouseDown = false));
  }

  scaleImage(direction) {
    const imageTl = gsap.timeline({
      defaults: {
        duration: 1.2,
        ease: "elastic.out(1, 1)",
        onUpdate: () => {
          this.resize();
        },
      },
    });
    if (direction == "up") {
      imageTl.to(this.el, {
        scale: window.innerHeight / 600,
      });
    } else if (direction == "down") {
      imageTl.to(this.el, {
        scale: 1,
      });
    }
  }

  run() {
    let m = mouseOver ? nMouse : new THREE.Vector2(0, 0);
    this.mouse.lerp(m, this.mouseLerpAmount);

    this.raycaster.setFromCamera(this.mouse, Gl.camera);
    let intersects = this.raycaster.intersectObject(this.mesh);
    if (intersects.length > 0) {
      this.material.uniforms.uMousePos.value = [
        intersects[0].uv.x,
        intersects[0].uv.y,
      ];
    }

    if (mouseOver) {
      this.material.uniforms.uMouseOverAmp.value = THREE.MathUtils.lerp(
        this.material.uniforms.uMouseOverAmp.value,
        1,
        0.08
      );
      this.mouseLerpAmount = THREE.MathUtils.lerp(
        this.mouseLerpAmount,
        0.1,
        0.5
      );
    } else {
      this.material.uniforms.uMouseOverAmp.value = THREE.MathUtils.lerp(
        this.material.uniforms.uMouseOverAmp.value,
        0,
        0.08
      );
      this.mouseLerpAmount = THREE.MathUtils.lerp(this.mouseLerpAmount, 0, 0.5);
    }

    if (mouseOver && mouseDown) {
      this.material.uniforms.uRadius.value = THREE.MathUtils.lerp(
        this.material.uniforms.uRadius.value,
        1,
        0.01
      );
    } else if (mouseOver && !mouseDown) {
      this.material.uniforms.uRadius.value = THREE.MathUtils.lerp(
        this.material.uniforms.uRadius.value,
        0.08,
        0.08
      );
    }

    if (this.state.animating) {
      this.material.uniforms.uMouseOverAmp.value = THREE.MathUtils.lerp(
        this.material.uniforms.uMouseOverAmp.value,
        0,
        0.1
      );
    }
  }
}

// -------- GL CLASSES [END] --------

// -------- MAIN CLASSES [START] --------

let mouse = new Mouse();

class Cursor {
  constructor(el) {
    this.DOM = { el: el };
    this.DOM.el.style.opacity = 0;

    this.bounds = this.DOM.el.getBoundingClientRect();

    this.renderedStyles = {
      tx: { previous: 0, current: 0, amt: 0.2 },
      ty: { previous: 0, current: 0, amt: 0.2 },
      scale: { previous: 0, current: 1, amt: 0.2 },
      opacity: { previous: 0, current: 1, amt: 0.15 },
    };
  }

  init() {
    this.onMouseMoveEv = () => {
      this.renderedStyles.tx.previous = this.renderedStyles.tx.current =
        mouse.position.x - this.bounds.width / 2;
      this.renderedStyles.ty.previous = this.renderedStyles.ty.previous =
        mouse.position.y - this.bounds.height / 2;
      requestAnimationFrame(() => this.render());
      window.removeEventListener("mousemove", this.onMouseMoveEv);
    };
    window.addEventListener("mousemove", this.onMouseMoveEv);
  }

  setTranslateLerpAmount(amount) {
    this.renderedStyles["tx"].amt = amount;
    this.renderedStyles["ty"].amt = amount;
    return this;
  }
  scale(amount = 1) {
    this.renderedStyles["scale"].current = amount;
    return this;
  }
  opaque(amount = 1) {
    this.renderedStyles["opacity"].current = amount;
    return this;
  }
  render() {
    this.renderedStyles["tx"].current =
      mouse.position.x - this.bounds.width / 2;
    this.renderedStyles["ty"].current =
      mouse.position.y - this.bounds.height / 2;

    for (const key in this.renderedStyles) {
      this.renderedStyles[key].previous = lerp(
        this.renderedStyles[key].previous,
        this.renderedStyles[key].current,
        this.renderedStyles[key].amt
      );
    }

    gsap.set(this.DOM.el, {
      translateX: this.renderedStyles["tx"].previous,
      translateY: this.renderedStyles["ty"].previous,
      scale: this.renderedStyles["scale"].previous,
      opacity: this.renderedStyles["opacity"].previous,
    });

    requestAnimationFrame(() => this.render());
  }
}

class Cursors {
  constructor() {
    this.DOM = {};

    this.DOM.cursorEls = {
      large: document.querySelector(".cursor--large"),
      small: document.querySelector(".cursor--small"),
      close: document.querySelector(".cursor--close"),
    };

    this.cursors = {
      large: new Cursor(this.DOM.cursorEls.large),
      small: new Cursor(this.DOM.cursorEls.small),
      close: new Cursor(this.DOM.cursorEls.close),
    };

    this.cursors.small.setTranslateLerpAmount(0.85);
    this.cursors.close.opaque(0).scale(0.5).setTranslateLerpAmount(0.5);
  }

  init() {
    Object.values(this.cursors).forEach((cursor) => {
      cursor.init();
    });
    this.initEvents();
  }

  initEvents() {
    this.initEventsOnElements();
    this.initEventsOnImage();
  }

  initEventsOnElements() {
    const onMouseEnter = () => {
      this.cursors.large.scale(2).opaque(0);
      this.cursors.small.scale(5);
    };

    const onMouseLeave = () => {
      this.cursors.large.scale(1).opaque(1);
      this.cursors.small.scale(1);
    };

    const onMouseDown = () => {
      this.cursors.small.scale(4);
    };

    const onMouseUp = () => {
      this.cursors.small.scale(5);
    };

    [
      ...document.querySelectorAll("a"),
      ...document.querySelectorAll("button"),
    ].forEach((element) => {
      element.addEventListener("mouseenter", onMouseEnter);
      element.addEventListener("mouseleave", onMouseLeave);
      element.addEventListener("mousedown", onMouseDown);
      element.addEventListener("mouseup", onMouseUp);
    });
  }

  initEventsOnImage() {
    const imageWrapper = document.querySelector(".slider__image--wrapper");

    const onMouseDown = () => {
      this.cursors.large.scale(2).opaque(0);
      this.cursors.small.scale(5);
    };

    const onMouseUp = () => {
      this.cursors.large.scale(1).opaque(1);
      this.cursors.small.scale(1);
    };

    imageWrapper.addEventListener("mousedown", onMouseDown);
    imageWrapper.addEventListener("mouseup", onMouseUp);
  }

  initEventsOnSlider(slider) {
    const imageWrapper = document.querySelector(".slider__image--wrapper");

    const onMouseEnter = () => {
      this.cursors.large.scale(2).opaque(0);
      this.cursors.small.scale(5).setTranslateLerpAmount(0.25);
      this.cursors.close.opaque(1).scale(1);
    };

    const onMouseLeave = () => {
      this.cursors.large.scale(1).opaque(1);
      this.cursors.small.scale(1).setTranslateLerpAmount(0.85);
      this.cursors.close.opaque(0).scale(0.5);
    };

    slider.onFullscreen(() => {
      onMouseEnter();
      imageWrapper.addEventListener("mouseenter", onMouseEnter);
      imageWrapper.addEventListener("mouseleave", onMouseLeave);
    });

    slider.offFullscreen(() => {
      onMouseLeave();
      imageWrapper.removeEventListener("mouseenter", onMouseEnter);
      imageWrapper.removeEventListener("mouseleave", onMouseLeave);
    });
  }
}

class Slideinfo {
  constructor(el) {
    this.DOM = { el: el };

    this.DOM.text = {
      index: this.DOM.el.querySelectorAll(".slide__index .char"),
      title: this.DOM.el.querySelectorAll(".slide__text--title .char"),
      description: this.DOM.el.querySelector(".slide__text--description"),
    };

    const split = new Splitter(this.DOM.text.description);

    const lines = [...split.linesEl.children].map((c) => [...c.children][0]);
    this.DOM.text.descriptionLines = lines;
  }
}

let clicked = false;

class Slideshow {
  constructor(el) {
    this.DOM = { el };
    this.DOM.imageWrapperEl = this.DOM.el.querySelector(
      ".slider__image--wrapper"
    );
    this.DOM.navigation = {
      prev: this.DOM.el.querySelector(".slider__nav--prev"),
      next: this.DOM.el.querySelector(".slider__nav--next"),
    };
    this.slideInfos = [];
    [...this.DOM.el.querySelectorAll(".slider__silde-info")].forEach((slide) =>
      this.slideInfos.push(new Slideinfo(slide))
    );
    this.current = 0;
    this.slidesTotal = this.slideInfos.length;

    this.GlSlider = new GlSlider();
    this.GlSlider.init(document.querySelector(".slider__image--wrapper"));

    this.initEvents();
  }

  init() {
    const currentSlideInfo = this.slideInfos[this.current];

    gsap.set(
      [currentSlideInfo.DOM.text.index, currentSlideInfo.DOM.text.title],
      {
        yPercent: 120,
        rotation: -3,
        stagger: -0.02,
      }
    );
    gsap.set(currentSlideInfo.DOM.text.descriptionLines, {
      yPercent: 100,
      stagger: 0.05,
    });
    gsap.set(this.DOM.navigation.prev, {
      translateX: 100,
      opacity: 0,
    });
    gsap.set(this.DOM.navigation.next, {
      translateX: -100,
      opacity: 0,
    });

    gsap.set(this.DOM.imageWrapperEl, {
      translateY: "150%",
      onUpdate: () => {
        this.GlSlider.setBounds();
      },
    });
  }

  initAnimation() {
    const currentSlideInfo = this.slideInfos[this.current];

    const tl = gsap
      .timeline({
        defaults: { duration: 1, ease: "power4.inOut" },
        delay: 0.25,
      })
      .addLabel("start", 0)
      .addLabel("upcoming", 1.25);
    tl.to(
      this.DOM.imageWrapperEl,
      {
        duration: 1.25,
        translateY: 0,
        ease: "sine.out",
        onUpdate: () => {
          this.GlSlider.setBounds();
        },
      },
      "start"
    )
      .to(
        this.GlSlider.material.uniforms.uAmplitude,
        {
          duration: 1,
          value: 1,
          repeat: 1,
          yoyo: true,
          yoyoEase: "sine.out",
          ease: "expo.out",
          onComplete: () => {
            this.GlSlider.material.uniforms.uTranslating = false;
          },
        },
        "start"
      )
      .to(
        [currentSlideInfo.DOM.text.index, currentSlideInfo.DOM.text.title],
        {
          yPercent: 0,
          rotation: 0,
          stagger: -0.02,
        },
        "upcoming"
      )
      .to(
        currentSlideInfo.DOM.text.descriptionLines,
        {
          yPercent: 0,
          stagger: 0.05,
        },
        "upcoming"
      )
      .to(
        [this.DOM.navigation.prev, this.DOM.navigation.next],
        {
          translateX: 0,
          opacity: 1,
        },
        "upcoming"
      );
  }

  initEvents() {
    this.onClickPrevEv = () => this.navigate("prev");
    this.onClickNextEv = () => this.navigate("next");
    this.onImageClickEv = () => {
      if (this.isAnimating) return;

      clicked = !clicked;

      const currentSlideInfo = this.slideInfos[this.current];

      const tl = gsap
        .timeline({
          defaults: { duration: 1, ease: "power4.inOut" },
          onStart: () => {
            this.isAnimating = true;
            if (clicked) {
              this.GlSlider.scaleImage("up");
              if (this.onFullscreenCallbackFn) this.onFullscreenCallbackFn();
            } else {
              this.GlSlider.scaleImage("down");
              if (this.offFullscreenCallbackFn) this.offFullscreenCallbackFn();
            }
          },
          onComplete: () => {
            this.isAnimating = false;
          },
        })
        .addLabel("start", clicked ? 0 : 0.2);

      tl.fromTo(
        [currentSlideInfo.DOM.text.index, currentSlideInfo.DOM.text.title],
        {
          yPercent: clicked ? 0 : 120,
          rotation: clicked ? 0 : -3,
        },
        {
          yPercent: clicked ? -120 : 0,
          rotation: clicked ? 3 : 0,
          stagger: clicked ? 0.02 : -0.02,
        },
        "start"
      )
        .fromTo(
          currentSlideInfo.DOM.text.descriptionLines,
          {
            yPercent: clicked ? 0 : 100,
          },
          {
            yPercent: clicked ? -100 : 0,
            stagger: 0.05,
          },
          "start"
        )
        .fromTo(
          this.DOM.navigation.prev,
          {
            translateX: clicked ? 0 : 100,
            opacity: clicked ? 1 : 0,
          },
          {
            translateX: clicked ? -100 : 0,
            opacity: clicked ? 0 : 1,
          },
          "start"
        )
        .fromTo(
          this.DOM.navigation.next,
          {
            translateX: clicked ? 0 : -100,
            opacity: clicked ? 1 : 0,
          },
          {
            translateX: clicked ? 100 : 0,
            opacity: clicked ? 0 : 1,
          },
          "start"
        )
        .set([this.DOM.navigation.prev, this.DOM.navigation.next], {
          pointerEvents: clicked ? "none" : "auto",
        });
    };

    this.DOM.navigation.prev.addEventListener("click", () =>
      this.onClickPrevEv()
    );
    this.DOM.navigation.next.addEventListener("click", () =>
      this.onClickNextEv()
    );
    this.DOM.imageWrapperEl.addEventListener("click", () =>
      this.onImageClickEv()
    );
  }

  onSlideChange(callback) {
    if (typeof callback == "function") {
      this.onSlideChangeCallbackFn = callback;
    }
  }

  onFullscreen(callback) {
    if (typeof callback == "function") {
      this.onFullscreenCallbackFn = callback;
    }
  }

  offFullscreen(callback) {
    if (typeof callback == "function") {
      this.offFullscreenCallbackFn = callback;
    }
  }

  navigate(direction) {
    if (this.GlSlider.state.animating) return;

    const incrementSlideIndex = (val) => {
      if (val > 0 && this.current + val < this.slidesTotal) {
        this.current += val;
      } else if (val > 0) {
        this.current = 0;
      } else if (val < 0 && this.current + val < 0) {
        this.current = this.slidesTotal - 1;
      } else {
        this.current += val;
      }
    };

    const increment = direction == "prev" ? -1 : 1;

    const currentSlideInfo = this.slideInfos[this.current];
    incrementSlideIndex(increment);
    const nextSlideInfo = this.slideInfos[this.current];

    this.GlSlider.switchTextures(this.current, increment);

    gsap
      .timeline({
        defaults: { duration: 1, ease: "power4.inOut" },
        onStart: () => {
          this.GlSlider.switchTextures(this.current, increment);
          if (this.onSlideChangeCallbackFn)
            this.onSlideChangeCallbackFn(this.current);
          this.isAnimating = true;
        },
        onComplete: () => {
          currentSlideInfo.DOM.el.classList.remove("slide--current");
          this.isAnimating = false;
        },
      })
      .addLabel("start", 0)
      .to(
        [currentSlideInfo.DOM.text.index, currentSlideInfo.DOM.text.title],
        {
          yPercent: direction === "next" ? -120 : 120,
          rotation: direction === "next" ? 3 : -3,
          stagger: direction === "next" ? 0.02 : -0.02,
        },
        "start"
      )
      .to(
        currentSlideInfo.DOM.text.descriptionLines,
        {
          yPercent: direction === "next" ? -100 : 100,
          stagger: direction === "next" ? 0.05 : -0.05,
        },
        "start"
      )
      .addLabel("upcoming", 0.4)
      .add(() => {
        gsap.set([nextSlideInfo.DOM.text.index, nextSlideInfo.DOM.text.title], {
          yPercent: direction === "next" ? 120 : -120,
          rotation: direction === "next" ? -3 : 3,
        });
        gsap.set(nextSlideInfo.DOM.text.descriptionLines, {
          yPercent: direction === "next" ? 100 : -100,
        });
        nextSlideInfo.DOM.el.classList.add("slide--current");
      }, "upcoming")
      .to(
        [nextSlideInfo.DOM.text.index, nextSlideInfo.DOM.text.title],
        {
          yPercent: 0,
          rotation: 0,
          stagger: direction === "next" ? 0.02 : -0.02,
        },
        "upcoming"
      )
      .to(
        nextSlideInfo.DOM.text.descriptionLines,
        {
          yPercent: 0,
          stagger: direction === "next" ? 0.05 : -0.05,
        },
        "upcoming"
      );
  }
}

// -------- MAIN CLASSES [END] --------

// -------- MAIN CODE [START] --------

const cursors = new Cursors();

Splitting();

const bgColors = ["#1f1322", "#27172e", "#454d53", "#2d1f2d"];

const masterTl = gsap.timeline();

preloadImages(document.querySelectorAll(".slider__image")).then(() => {
  const slider = new Slideshow(document.querySelector(".slider"));
  slider.init();

  const loadedAnimationTl = gsap
    .timeline({
      onStart: () => {
        gsap.set(".text__row .text", { autoAlpha: 1 });
      },
    })
    .to(".loading__text", {
      duration: 1,
      opacity: 0,
    })
    .from(".text__row .text", {
      duration: 3,
      translateY: (i) => -100 + i * -25 + "%",
      ease: "expo.out",
      stagger: 0.1,
    })
    .to(".text__row .text", {
      duration: 3,
      translateY: (i) => 100 + i * 25 + "%",
      ease: "expo.in",
      stagger: 0.25,
    })
    .to(".bg__transition--slide", {
      duration: 1,
      scaleY: 0,
      transformOrigin: "top center",
      ease: "expo.out",
      onComplete: () => {
        slider.initAnimation();
        gsap.set(".loading__wrapper", {
          pointerEvents: "none",
          autoAlpha: 0,
        });
      },
    });

  const pageAnimationTl = gsap
    .timeline({
      delay: loadedAnimationTl.duration(),
      onComplete: () => {
        cursors.init();
        cursors.initEventsOnSlider(slider);
      },
    })
    .from(
      [
        ".frame__logo",
        ".frame__button",
        ".frame__artist > span",
        ".frame__credits > span",
      ],
      {
        duration: 1,
        opacity: 0,
        yPercent: 100,
        stagger: 0.1,
        ease: "expo.out",
      }
    );

  masterTl.add(loadedAnimationTl, 0);
  masterTl.add(pageAnimationTl, pageAnimationTl.duration() - 0.5);

  slider.onSlideChange((currentSlideIndex) => {
    gsap.to("body", {
      duration: 1.2,
      backgroundColor: bgColors[currentSlideIndex],
    });
  });
});

// -------- MAIN CODE [END] --------
