/* =========================
   header.js (Safari-safe) - 전체본
   - PC: 인트로에서 헤더 숨김 / 프로젝트 구간에서 스크롤 방향 hide/show / 상단 호버 show
   - MO/TB: 일정 구간부터 햄버거 노출 + 메뉴 오픈/클로즈 + 오버레이
   - Contact: dropdown 토글(링크 클릭은 정상 동작)
========================= */

document.addEventListener("DOMContentLoaded", () => {
  const headerEl = document.querySelector("header");
  const menuBtn = document.querySelector(".menu-mo");
  const closeBtn = document.querySelector(".menu-close");
  const overlay = document.querySelector(".menu-overlay");
  const aboutSection = document.querySelector(".about");
  const introOverlay = document.querySelector(".overlay-contents");
  const projectFrames = document.querySelectorAll(".project-frame");

  if (!headerEl || !aboutSection) return;

  // ===========================
  // Helpers
  // ===========================
  const isPC = () => window.innerWidth > 1200;

  // Safari-safe: 문서 기준 위치
  const getDocTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const getDocBottom = (el) =>
    el.getBoundingClientRect().bottom + window.scrollY;

  const getHeaderH = () => headerEl.getBoundingClientRect().height || 100;

  // 헤더 높이 CSS 변수 동기화 (CSS에서 --header-h 사용 시 안정화)
  function syncHeaderHeightVar() {
    const h = getHeaderH();
    document.documentElement.style.setProperty("--header-h", `${h}px`);
  }

  // --------------------------------
  // project 구간 판별 (여러 frame 지원)
  // --------------------------------
  function getProjectState(scrollY) {
    if (!projectFrames || projectFrames.length === 0) {
      return { inProject: false, firstTop: 0, lastBottom: 0 };
    }

    let inProject = false;
    let firstTop = Infinity;
    let lastBottom = -Infinity;

    projectFrames.forEach((frame) => {
      const top = getDocTop(frame);
      const bottom = getDocBottom(frame);

      if (top < firstTop) firstTop = top;
      if (bottom > lastBottom) lastBottom = bottom;

      if (scrollY >= top && scrollY < bottom) inProject = true;
    });

    return { inProject, firstTop, lastBottom };
  }

  // ===========================
  // 1) 모바일/태블릿: 햄버거 노출 타이밍
  // ===========================
  function updateMobileHamburger() {
    if (!menuBtn) return;

    if (isPC()) {
      document.body.classList.remove("show-mobile-menu");
      headerEl.classList.remove("is-open");
      overlay?.classList.remove("is-open");
      document.body.style.overflow = "";
      return;
    }

    const scrollY = window.scrollY;

    let threshold = 0;
    if (introOverlay) {
      threshold = getDocBottom(introOverlay) - 40;
    } else {
      threshold = getDocTop(aboutSection) - 10;
    }

    if (scrollY >= threshold) {
      document.body.classList.add("show-mobile-menu");
    } else {
      document.body.classList.remove("show-mobile-menu");
      headerEl.classList.remove("is-open");
      overlay?.classList.remove("is-open");
      document.body.style.overflow = "";
    }
  }

  // ===========================
  // 2) 모바일/태블릿: 햄버거 메뉴 열기/닫기
  // ===========================
  function openMenu() {
    if (!isPC()) {
      headerEl.classList.add("is-open");
      overlay?.classList.add("is-open");
      document.body.style.overflow = "hidden";
      menuBtn?.classList.add("is-hidden");
    }
  }

  function closeMenu() {
    headerEl.classList.remove("is-open");
    overlay?.classList.remove("is-open");
    document.body.style.overflow = "";
    menuBtn?.classList.remove("is-hidden");
  }

  if (menuBtn && closeBtn && overlay) {
    menuBtn.addEventListener("click", openMenu);
    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  // ===========================
  // 3) PC 전용: 인트로/프로젝트 헤더 동작
  // ===========================
  let lastScrollY = window.scrollY;

  function runPCHeaderLogic() {
    if (!isPC()) {
      // 모바일에선 헤더 숨김/보임 클래스 제거
      headerEl.classList.remove(
        "header-intro-hide",
        "header-project-hide",
        "header-project-show"
      );
      return;
    }

    const scrollY = window.scrollY;

    // introBottom 계산
    const introBottom = introOverlay ? getDocBottom(introOverlay) : 0;

    // 1) 인트로 영역에서는 헤더 숨김
    if (introOverlay && scrollY < introBottom - 40) {
      headerEl.classList.add("header-intro-hide");
      headerEl.classList.remove("header-project-hide", "header-project-show");
      lastScrollY = scrollY;
      return;
    } else {
      // 인트로 지나면 무조건 제거(사파리에서 남는 버그 방지)
      headerEl.classList.remove("header-intro-hide");
    }

    // 2) 프로젝트 구간 판별
    const { inProject } = getProjectState(scrollY);

    if (inProject) {
      const delta = scrollY - lastScrollY;

      // 미세 떨림 방지(사파리에서 흔함)
      if (delta < -5) {
        headerEl.classList.add("header-project-show");
        headerEl.classList.remove("header-project-hide");
      } else if (delta > 5) {
        headerEl.classList.add("header-project-hide");
        headerEl.classList.remove("header-project-show");
      }
    } else {
      headerEl.classList.remove("header-project-hide", "header-project-show");
    }

    lastScrollY = scrollY;
  }

  // ===========================
  // 4) PC: 화면 최상단 호버 시 헤더 보이기
  // ===========================
  function handlePCHover(e) {
    if (!isPC()) return;
    if (!projectFrames || projectFrames.length === 0) return;

    const scrollY = window.scrollY;
    const { inProject } = getProjectState(scrollY);
    if (!inProject) return;

    if (e.clientY <= 5) {
      headerEl.classList.add("header-project-show");
      headerEl.classList.remove("header-project-hide");
    }
  }

  // ===========================
  // 5) 이벤트 (스크롤 rAF 쓰로틀)
  // ===========================
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      updateMobileHamburger();
      runPCHeaderLogic();
      ticking = false;
    });
  }

  function onResize() {
    syncHeaderHeightVar(); // ✅ resize마다 헤더 높이 동기화
    updateMobileHamburger();
    runPCHeaderLogic();
  }

  // ===========================
  // 6) CONTACT dropdown
  // ===========================
  const contact = document.querySelector(".nav-contact");
  const dropdown = contact?.querySelector(".dropdown");

  function closeDropdown() {
    dropdown?.classList.remove("show");
  }

  if (contact && dropdown) {
    contact.addEventListener("click", (e) => {
      // 드롭다운 내부 링크(a) 클릭은 기본 동작 유지
      if (e.target.closest(".dropdown")) return;

      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });

    document.addEventListener("click", closeDropdown);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });
  }

  // ===========================
  // 초기 실행
  // ===========================
  syncHeaderHeightVar();
  updateMobileHamburger();
  runPCHeaderLogic();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("mousemove", handlePCHover);
});
