"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type ContactSectionProps = {
  colors?: string[];
};

export function ContactSectionWithShader({
  colors,
}: ContactSectionProps) {
  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    const target = e.target as HTMLFormElement;
    console.log(target);
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-neutral-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:px-8 lg:grid-cols-2 lg:py-20">
        {/* Left - Shader with Testimonials */}
        <div className="relative order-last h-[500px] overflow-hidden rounded-3xl md:order-first lg:h-auto">
          <ShaderBackground colors={colors} />
          <div className="absolute inset-0 z-10 flex items-center justify-center p-8">
            <RotatingTestimonials />
          </div>
        </div>

        {/* Right - Contact Form */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-lg rounded-3xl px-4 py-8 md:px-10">
            <div>
              <h1 className="mt-4 text-2xl leading-9 font-bold tracking-tight text-black dark:text-white">
                Contact Us
              </h1>
              <p className="mt-4 max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
                Please reach out to us and we will get back to you at the speed
                of light.
              </p>
            </div>

            <div className="py-10">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label
                  htmlFor="name"
                  className="block text-sm leading-6 font-medium text-neutral-700 dark:text-neutral-400"
                >
                  Full Name
                </label>

                <div className="mt-2">
                  <input
                    id="name"
                    type="text"
                    placeholder="Manu Arora"
                    className="block w-full rounded-md border-0 bg-white px-4 py-1.5 text-black shadow-sm ring-1 shadow-black/10 ring-black/10 placeholder:text-gray-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:bg-neutral-900 dark:text-white dark:shadow-white/5 dark:ring-white/5"
                  />
                </div>

                <label
                  htmlFor="email"
                  className="block text-sm leading-6 font-medium text-neutral-700 dark:text-neutral-400"
                >
                  Email address
                </label>

                <div className="mt-2">
                  <input
                    id="email"
                    type="email"
                    placeholder="hello@johndoe.com"
                    className="block w-full rounded-md border-0 bg-white px-4 py-1.5 text-black shadow-sm ring-1 shadow-black/10 ring-black/10 placeholder:text-gray-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:bg-neutral-900 dark:text-white dark:shadow-white/5 dark:ring-white/5"
                  />
                </div>

                <label
                  htmlFor="company"
                  className="block text-sm leading-6 font-medium text-neutral-700 dark:text-neutral-400"
                >
                  Company
                </label>

                <div className="mt-2">
                  <input
                    id="company"
                    type="text"
                    placeholder="Aceternity Labs, LLC"
                    className="block w-full rounded-md border-0 bg-white px-4 py-1.5 text-black shadow-sm ring-1 shadow-black/10 ring-black/10 placeholder:text-gray-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:bg-neutral-900 dark:text-white dark:shadow-white/5 dark:ring-white/5"
                  />
                </div>

                <label
                  htmlFor="message"
                  className="block text-sm leading-6 font-medium text-neutral-700 dark:text-neutral-400"
                >
                  Message
                </label>

                <div className="mt-2">
                  <textarea
                    rows={5}
                    id="message"
                    placeholder="Enter your message here"
                    className="block w-full rounded-md border-0 bg-white px-4 py-1.5 text-black shadow-sm ring-1 shadow-black/10 ring-black/10 placeholder:text-gray-400 focus:ring-2 focus:ring-neutral-400 focus:outline-none sm:text-sm sm:leading-6 dark:bg-neutral-900 dark:text-white dark:shadow-white/5 dark:ring-white/5"
                  />
                </div>

                <div className="mt-8">
                  <button className="relative z-10 flex w-full items-center justify-center rounded-full bg-black px-4 py-4 text-sm font-medium text-white transition duration-200 hover:bg-black/90 md:text-sm dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:hover:shadow-xl">
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const testimonials = [
  {
    quote:
      "This platform has completely transformed how we approach customer outreach. The results speak for themselves.",
    name: "Sarah Chen",
    designation: "Head of Marketing, TechCorp",
    image: "https://assets.aceternity.com/avatars/1.webp",
  },
  {
    quote:
      "The AI-powered insights have helped us close 40% more deals. It's like having a superpower for sales.",
    name: "Marcus Johnson",
    designation: "VP of Sales, StartupXYZ",
    image: "https://assets.aceternity.com/avatars/2.webp",
  },
  {
    quote:
      "We've cut our response time in half and our customer satisfaction has never been higher. Incredible tool.",
    name: "Emily Rodriguez",
    designation: "Customer Success Lead, GrowthCo",
    image: "https://assets.aceternity.com/avatars/3.webp",
  },
  {
    quote:
      "The integration was seamless and the support team is phenomenal. Highly recommend to any growing business.",
    name: "David Kim",
    designation: "CTO, InnovateLabs",
    image: "https://assets.aceternity.com/avatars/4.webp",
  },
];

function RotatingTestimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex h-full w-full max-w-md items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full"
        >
          <TestimonialCard testimonial={testimonials[currentIndex]} />
        </motion.div>
      </AnimatePresence>

      {/* Indicators */}
      <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "w-6 bg-white"
                : "bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-md md:p-8">
      <svg
        className="mb-4 h-8 w-8 text-white/60"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <p className="text-lg leading-relaxed font-medium text-white md:text-xl">
        {testimonial.quote}
      </p>
      <div className="mt-6 flex items-center gap-4">
        <img
          src={testimonial.image}
          alt={testimonial.name}
          className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30"
        />
        <div>
          <p className="font-semibold text-white">{testimonial.name}</p>
          <p className="text-sm text-white/70">{testimonial.designation}</p>
        </div>
      </div>
    </div>
  );
}

function resolveCssColorToRGB(color: string): [number, number, number] {
  if (typeof document === "undefined") {
    return [128, 128, 128];
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [128, 128, 128];

  const el = document.createElement("div");
  el.style.color = color;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;

  return [data[0], data[1], data[2]];
}

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_colors[5];

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  vec3 blendNormal(vec3 base, vec3 blend, float opacity) {
    return blend * opacity + base * (1.0 - opacity);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    float time = u_time * 0.15;

    vec2 nCoord = vec2(uv.x * aspect, uv.y) * 0.4;

    // Base color (u_colors[0])
    vec3 color = u_colors[0];

    // Layer 1 (u_colors[1])
    float n1 = snoise(vec3(
      nCoord.x * 1.3 + time * 0.5,
      nCoord.y * 1.6,
      time * 0.3 + 3.0
    ));
    n1 = smoothstep(0.15, 0.7, n1 * 0.5 + 0.5);
    color = blendNormal(color, u_colors[1], pow(n1, 3.5));

    // Layer 2 (u_colors[2])
    float n2 = snoise(vec3(
      nCoord.x * 1.5 + time * 0.4,
      nCoord.y * 1.8,
      time * 0.35 + 12.0
    ));
    n2 = smoothstep(0.18, 0.75, n2 * 0.5 + 0.5);
    color = blendNormal(color, u_colors[2], pow(n2, 3.5));

    // Layer 3 (u_colors[3])
    float n3 = snoise(vec3(
      nCoord.x * 1.1 - time * 0.35,
      nCoord.y * 1.4,
      time * 0.25 + 24.0
    ));
    n3 = smoothstep(0.20, 0.80, n3 * 0.5 + 0.5);
    color = blendNormal(color, u_colors[3], pow(n3, 4.0));

    // Layer 4 (u_colors[4])
    float n4 = snoise(vec3(
      nCoord.x * 0.9 + time * 0.2,
      nCoord.y * 1.2,
      time * 0.15 + 36.0
    ));
    n4 = smoothstep(0.25, 0.85, n4 * 0.5 + 0.5);
    color = blendNormal(color, u_colors[4], pow(n4, 4.0));

    // Vignette for depth
    float vignette = smoothstep(1.2, 0.4, length(uv - vec2(0.5)));
    color *= vignette * 0.85 + 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

type ShaderBackgroundProps = {
  colors?: string[];
};

const defaultColors = [
  "#1a0a0a", // Base: deep burgundy black
  "#ff6b35", // Layer 1: vibrant orange
  "#f72585", // Layer 2: hot pink/magenta
  "#ffd60a", // Layer 3: golden yellow
  "#dc2626", // Layer 4: bright red
];

function ShaderBackground({ colors = defaultColors }: ShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const createShader = useCallback(
    (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    },
    [],
  );

  const parseColors = useCallback(() => {
    const resolved = [...colors];
    while (resolved.length < 5) {
      resolved.push(resolved[resolved.length - 1] ?? "#7c3aed");
    }
    const rgb = resolved.slice(0, 5).map((c) => {
      const [r, g, b] = resolveCssColorToRGB(c);
      return [r / 255, g / 255, b / 255] as [number, number, number];
    });
    return rgb.flat();
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uColors = gl.getUniformLocation(program, "u_colors");

    const colorArray = new Float32Array(parseColors());
    gl.uniform3fv(uColors, colorArray);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const startTime = performance.now();
    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [createShader, parseColors]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ display: "block" }}
      />
      {/* Noise overlay for texture */}
      <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full opacity-[0.25]">
        <filter id="contactShaderNoise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#contactShaderNoise)" />
      </svg>
    </>
  );
}
