// loading.js

document.addEventListener("DOMContentLoaded", () => {
  // ===== 기본 요소 찾기 =====
  const pct  = document.getElementById("percent");    // 퍼센트 숫자
  const pre  = document.getElementById("preloader");  // 로딩 오버레이
  const view = document.getElementById("viewport");   // 스냅 래퍼(없을 수도 있음)

  // 필수 요소가 없으면 로더 스크립트 중단
  if (!pct || !pre) {
    console.warn("preloader 또는 percent 요소를 찾을 수 없습니다.");
    return;
  }

  // 로딩 중 스크롤 막기
  document.body.style.overflow = "hidden";

  // ===== 퍼센트 증가 타이머 =====
  let n = 0;
  const timer = setInterval(() => {
    n += 1;
    if (n > 100) n = 100;

    pct.textContent = n + "%";

    if (n === 100) {
      clearInterval(timer);

      // 첫 섹션(인트로)만 먼저 로드
      preloadFirst().finally(() => {
        // 로더 위로 올리기 (CSS에서 .up에 transition 있어야 함)
        pre.classList.add("up");

        // 트랜지션 끝나면 오버레이 제거
        pre.addEventListener(
          "transitionend",
          () => {
            pre.style.display = "none";
            document.body.style.overflow = "auto";

            // ✅ viewport가 있을 때만 aria-hidden 해제
            if (view) {
              view.removeAttribute("aria-hidden");
            }
          },
          { once: true }
        );
      });
    }
  }, 10);

  // ===== 첫 섹션(인트로) 선로드 =====
  async function preloadFirst() {
    const intro = document.querySelector("#intro[data-src]");
    if (!intro || intro.dataset.loaded) return;

    try {
      const res = await fetch(intro.dataset.src, { cache: "no-store" });
      intro.innerHTML = await res.text();
      intro.dataset.loaded = "1";
    } catch (e) {
      console.error("인트로 로드 실패:", e);
      intro.innerHTML = '<p style="padding:2rem">인트로 로드 실패 😢</p>';
    }
  }

  // ===== 나머지 섹션 지연 로드 (보일 때 fetch) =====
  const sections = document.querySelectorAll("section[data-src]");

  if (sections.length > 0) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target;
          if (el.dataset.loaded) return;

          try {
            const res = await fetch(el.dataset.src, { cache: "no-store" });
            el.innerHTML = await res.text();
            el.dataset.loaded = "1";
          } catch (e) {
            console.error("섹션 로드 실패:", e);
            el.innerHTML = '<p style="padding:2rem">섹션 로드 실패 😢</p>';
          }
        });
      },
      {
        // ✅ viewport가 있으면 그걸 기준으로, 없으면 기본 윈도우 기준으로 관찰
        root: view || null,
        threshold: 0.12,
      }
    );

    sections.forEach((s) => io.observe(s));
  }
});
