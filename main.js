var svgElement = document.getElementById('starwheel');
var angle = 0;

function rotateSVG() {
  angle += 0.005; // Aumentează unghiul cu fiecare apel

  var rotationTransform = 'rotate(' + angle + 'deg)';
  svgElement.style.transform = rotationTransform;

  requestAnimationFrame(rotateSVG); // Continuă animația
}

rotateSVG(); // Inițializează animația






const { THREE } = window;

const FLAGS = Object.freeze({
    ENABLE_ORBIT_CONTROLS: false,
});

const COLOR_PALETTE = Object.freeze({
    black: 0x010101,
    wave: 0xe63946,
});

const GLSL_UTILS = Object.freeze({
    rand: `
        float crand(vec2 seed) {
            return fract(sin(dot(seed, vec2(12.9898,78.233))) * 43758.5453123);
        }
    `,
    noise: `
        float noise(vec2 position) {
            vec2 p = floor(position);
            float tl = crand(p);
            float tr = crand(p + vec2(1.0, 0.0));
            float bl = crand(p + vec2(0.0, 1.0));
            float br = crand(p + vec2(1.0, 1.0));
            vec2 v = smoothstep(0.0, 1.0, fract(position));

            return mix(tl, tr, v.x)
                + (bl - tl) * v.y * (1.0 - v.x)
                + (br - tr) * v.x * v.y
                - 0.5;
        }
    `,
});

class CustomMaterial extends THREE.MeshStandardMaterial {
    onBeforeCompile(shader) {
        // eslint-disable-next-line no-param-reassign
        shader.uniforms.uTime = { value: 0.0 };

        // eslint-disable-next-line no-param-reassign
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_pars_vertex>',
            `varying vec2 vUv;
            uniform float uTime;`,
        );

        // eslint-disable-next-line no-param-reassign
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_vertex>',
            'vUv = uv;',
        );

        // eslint-disable-next-line no-param-reassign
        shader.fragmentShader = shader.fragmentShader.replace(
            'varying vec3 vViewPosition;',
            `varying vec3 vViewPosition;
            varying vec2 vUv;
            uniform float uTime;`,
        );

        this.userData.shader = shader;
    }
}

class WavesMaterial extends CustomMaterial {
    constructor() {
        super({
            color: COLOR_PALETTE.wave,
            side: THREE.DoubleSide,
        });
    }

    onBeforeCompile(shader) {
        super.onBeforeCompile(shader);

        // eslint-disable-next-line no-param-reassign
        shader.vertexShader = `
            ${GLSL_UTILS.rand}
            ${GLSL_UTILS.noise}

            float getWaveZ(vec2 xy, float time) {
                float t = 0.2 * time;

                return 30.0 * sin(3.3 * uv.x)
                    + 5.0 * sin(0.1 * xy.y) * noise(0.2 * xy - 2.0 * t);
            }

            ${shader.vertexShader}
        `;

        // eslint-disable-next-line no-param-reassign
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
                #include <begin_vertex>

                transformed =
                    position
                    + vec3(0.0, 0.0, getWaveZ(position.xy, uTime));

                float d = 0.0001;

                vNormal = normalize(
                    cross(
                        vec3(  d, 0.0, getWaveZ(vec2(position.x + d, position.y), uTime))
                        -vec3(-d, 0.0, getWaveZ(vec2(position.x - d, position.y), uTime)),
                        vec3( 0.0,  d, getWaveZ(vec2(position.x, position.y + d), uTime))
                        -vec3(0.0, -d, getWaveZ(vec2(position.x, position.y - d), uTime))
                    )
                );
            `,
        );

        // eslint-disable-next-line no-param-reassign
        shader.fragmentShader = `
            ${GLSL_UTILS.rand}
            ${GLSL_UTILS.noise}
            ${shader.fragmentShader}
        `;

        // eslint-disable-next-line no-param-reassign
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
                #include <map_fragment>

                float c = 0.5 * abs(noise(vec2(30.0 * vUv.x, 300.0 * vUv.y)));

                diffuseColor = diffuseColor - vec4(c, c, c + 0.05, 0.0);
            `,
        );

        this.userData.shader = shader;
    }
}

class MaterialsLibrary {
    static waves = new WavesMaterial();
}

class SandboxWorld extends THREE.Group {
    constructor() {
        super();

        this.#initObjects();
        this.#initLights();
    }

    #initObjects() {
        const geometry = new THREE.PlaneGeometry(80, 30, 200, 100);
        const material = MaterialsLibrary.waves;
        const wave1 = new THREE.Mesh(geometry, material);

        this.add(wave1);

        const wave2 = new THREE.Mesh(geometry, material);

        wave2.position.set(5, 0, 5);
        wave2.rotation.set(Math.PI * 0.8, 0.1, 0.1);

        this.add(wave2);

        const wave3 = new THREE.Mesh(geometry, material);

        wave3.position.set(10, 0, -2);
        wave3.rotation.set(Math.PI * 0.8, 0.3, 0.1);

        this.add(wave3);
    }

    #initLights() {
        const ambient = new THREE.AmbientLight(COLOR_PALETTE.white, 0.5);

        this.add(ambient);

        const directional = new THREE.DirectionalLight(COLOR_PALETTE.white);

        directional.position.set(1, 0.2, 1);

        this.add(directional);
    }
}

class FullScreen3DExample {
    static CSS_ROOT = 'full-screen-3d-example';
    static CSS_ROOT_LOADED_VARIANT = '-loaded';

    #root;
    #frameRequestId;
    #scene;
    #world;
    #camera;
    #controls;
    #renderer;

    constructor(root) {
        this.#root = root;
        this.#root.classList.add(FullScreen3DExample.CSS_ROOT);
        this.#initScene();
        this.#initObjects();
        this.#initCamera();
        this.#initRenderer();
        this.#initControls();
        this.#initEventListeners();
        this.#onWindowResize();
        this.#root.classList.add(FullScreen3DExample.CSS_ROOT_LOADED_VARIANT);
        this.#render();
    }

    #initScene() {
        this.#scene = new THREE.Scene();
    }

    #initObjects() {
        this.#world = new SandboxWorld();

        this.#scene.add(this.#world);
    }

    #initCamera() {
        const fov = 45;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 1;
        const far = 1000;

        this.#camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.#camera.position.set(3, -55, 0);
        this.#camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
    }

    #initRenderer() {
        const clearColor = COLOR_PALETTE.white;
        const clearColorAlpha = 1;

        this.#renderer = new THREE.WebGLRenderer({
            alpha: false,
            logarithmicDepthBuffer: true,
        });

        this.#renderer.setClearColor(clearColor, clearColorAlpha);
        this.#renderer.setPixelRatio(window.devicePixelRatio);

        if (FLAGS.ENABLE_SHADOWS) {
            this.#renderer.shadowMap.enabled = true;
            this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        this.#root.appendChild(this.#renderer.domElement);
    }

    #initControls() {
        if (FLAGS.ENABLE_ORBIT_CONTROLS) {
            this.#controls = new THREE.OrbitControls(
                this.#camera,
                this.#renderer.domElement,
            );
        }
    }

    #initEventListeners() {
        window.addEventListener('resize', this.#onWindowResize.bind(this));
    }

    #onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.#camera.aspect = width / height;
        this.#camera.updateProjectionMatrix();
        this.#renderer.setSize(width, height);
    }

    #updateEverything() {
        const t = performance.now() / 1000;

        this.#scene.traverse((child) => {
            if (child.isMesh) {
                const { shader } = child.material.userData;

                if (shader) {
                    shader.uniforms.uTime.value = t;
                }
            }
        });
    }

    #render() {
        this.#updateEverything();

        this.#renderer.render(this.#scene, this.#camera);
    }

    start() {
        this.#render();

        if (FLAGS.ENABLE_ORBIT_CONTROLS) {
            this.#controls.update();
        }

        this.#frameRequestId = requestAnimationFrame(this.start.bind(this));
    }

    stop() {
        cancelAnimationFrame(this.#frameRequestId);
    }
}

function main() {
    const root = document.getElementById('root');
    const example = new FullScreen3DExample(root);

    example.start();
}

document.addEventListener('DOMContentLoaded', main);















function openTab(evt, tab) {
	var i, tabcontent, tablinks;
	tabcontent = document.getElementsByClassName("content__inner");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}
	tablinks = document.getElementsByClassName("tab");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	document.getElementById(tab).style.display = "block";
	evt.currentTarget.className += " active";
}

//Horizontal scroll for the tabs on mousewheel. If tabs are longer than the content section, there's a scroll bar but it's hidden to retain the design.
if (window.innerWidth > 800) {
	const scrollContainer = document.querySelector(".tabs");

	scrollContainer.addEventListener("wheel", (evt) => {
		evt.preventDefault();
		scrollContainer.scrollLeft += evt.deltaY;
	});
}
