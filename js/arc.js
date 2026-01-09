// js/arc.js
document.addEventListener("DOMContentLoaded", () => {
  // 갤러리 안에 있는 이미지들
  const imgs = document.querySelectorAll(".char-gallery img");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.querySelector(".lightbox-img");
  const closeBtn = document.querySelector(".close");

  if (!lightbox || !lightboxImg) {
    console.warn("라이트박스 요소를 찾지 못했습니다.");
    return;
  }

  // 이미지 클릭 → 라이트박스 열기
  imgs.forEach((img) => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src; // 썸네일 = 원본이니까 그대로 사용
      lightbox.classList.add("show");
    });
  });

  // 닫기 버튼
  closeBtn.addEventListener("click", () => {
    lightbox.classList.remove("show");
    lightboxImg.src = "";
  });

  // 배경 클릭 시 닫기
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove("show");
      lightboxImg.src = "";
    }
  });

  // ESC 키로 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      lightbox.classList.remove("show");
      lightboxImg.src = "";
    }
  });
});
