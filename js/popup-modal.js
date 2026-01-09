// js/popup-modal.js
document.addEventListener("DOMContentLoaded", () => {
  const overlays     = document.querySelectorAll(".pop-up__overlay");
  const modal        = document.getElementById("designModal");
  const modalImg     = document.getElementById("designModalImg");
  const modalTitle   = document.getElementById("designModalTitle");
  const modalDesc    = document.getElementById("designModalDesc");
  const modalIntent  = document.getElementById("designModalIntent");
  const modalTags    = document.getElementById("designModalTags");
  const btnClose     = modal ? modal.querySelector(".design-modal__close") : null;
  const modalBg      = modal ? modal.querySelector(".design-modal__overlay") : null;
  const openTrigger  = document.querySelector("[data-modal-open='designModal']");

  // 모달이 아예 없으면 종료
  if (!modal) {
    console.warn("designModal 요소를 찾지 못했습니다.");
    return;
  }

  // 마지막으로 모달을 연 트리거 (포커스 복귀용)
  let lastTrigger = null;

  // 🔹 모달 안 스크롤만 리셋 (실제 스크롤 컨테이너: .design-modal__figure)
  function resetModalScroll() {
    // 혹시 모달 자체가 스크롤 컨테이너인 경우
    modal.scrollTop = 0;

    const fig = modal.querySelector(".design-modal__figure");
    if (fig) {
      fig.scrollTop = 0;
    }
  }

  // 🔹 모달 열기
  function openModal(trigger) {
    lastTrigger = trigger || lastTrigger;

    const card    = trigger.closest(".pop-up__card");
    const imgEl   = card ? card.querySelector(".pop-up__thumb img") : null;
    const titleEl = card ? card.querySelector(".pop-up__name") : null;
    const descEl  = card ? card.querySelector(".pop-up__sub") : null;

    const data   = trigger.dataset;

    const imgSrc = imgEl ? imgEl.src : "";
    const imgAlt = imgEl ? imgEl.alt : "";

    const title  = data.title  || (titleEl ? titleEl.textContent.trim() : "");
    const desc   = data.desc   || (descEl  ? descEl.textContent.trim()  : "");
    const intent = data.intent || "";

    // 이미지 세팅
    if (modalImg && imgSrc) {
      modalImg.src = imgSrc;
      modalImg.alt = imgAlt || title || "design image";
    }

    // 텍스트 세팅
    if (modalTitle)  modalTitle.textContent  = title;
    if (modalDesc)   modalDesc.textContent   = desc;
    if (modalIntent) modalIntent.textContent = intent;

    // 태그 버튼들 세팅 (sup 살리려고 innerHTML)
    if (modalTags) {
      const raw = data.tags || "";
      modalTags.innerHTML = "";

      if (raw) {
        raw.split(",").forEach((tag) => {
          const t = tag.trim();
          if (!t) return;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tag-chip";
          btn.innerHTML = t; // sup 유지
          modalTags.appendChild(btn);
        });
      }
    }

    // 모달 내부 스크롤 리셋 (이미 열기 전에 한 번)
    resetModalScroll();

    // 모달 열기 (CSS에 어떤 걸 쓰든 대응되게 둘 다 추가)
    modal.classList.add("is-open", "on");
    modal.setAttribute("aria-hidden", "false");

    // 배경 스크롤만 막기
    document.body.style.overflow = "hidden";

    // 이미지 로딩/레이아웃 변화 때문에 한 프레임 뒤에도 한 번 더 리셋
    setTimeout(() => {
      resetModalScroll();
    }, 0);

    // 포커스 모달 안으로 이동
    if (btnClose) {
      btnClose.focus();
    } else {
      const focusable = modal.querySelector(
        "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable) focusable.focus();
    }
  }

  // 🔹 모달 닫기
  function closeModal() {
    if (
      !modal.classList.contains("is-open") &&
      !modal.classList.contains("on")
    ) return;

    // 먼저 포커스를 원래 트리거로 돌려주기
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    } else if (openTrigger && typeof openTrigger.focus === "function") {
      openTrigger.focus();
    }

    modal.classList.remove("is-open", "on");
    modal.setAttribute("aria-hidden", "true");

    // 배경 스크롤 다시 활성화
    document.body.style.overflow = "";
  }

  // 🔹 각 썸네일 오버레이 클릭 → 모달 열기
  overlays.forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      e.preventDefault();     // <a href="#"> 위로 튀는 기본 동작 막기
      openModal(overlay);
    });
  });

  // 🔹 닫기 버튼
  if (btnClose) {
    btnClose.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // 🔹 배경 클릭 시 닫기
  if (modalBg) {
    modalBg.addEventListener("click", (e) => {
      if (e.target === modalBg) {
        closeModal();
      }
    });
  }

  // 🔹 ESC 키로 닫기
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      (modal.classList.contains("is-open") ||
        modal.classList.contains("on"))
    ) {
      closeModal();
    }
  });
});
