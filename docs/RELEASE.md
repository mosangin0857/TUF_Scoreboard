# 새 버전 배포 방법

BJ들이 쓰는 앱은 GitHub Releases의 최신 릴리스를 보고 자동 업데이트합니다.
릴리스에 `latest.yml`, 설치파일(`.exe`), `.blockmap` 세 파일이 함께 올라가 있어야 업데이트가 됩니다.

## 방법 1: 태그만 올리기 (GitHub Actions가 빌드·배포)

```bash
npm version patch      # 0.1.0 → 0.1.1  (기능 추가는 minor, 큰 변경은 major)
git push --follow-tags
```

`v*` 태그가 올라가면 `.github/workflows/release.yml`이 윈도우에서 설치파일을 만들고 릴리스에 올립니다.
Actions 탭에서 진행 상황을 볼 수 있습니다.

## 방법 2: 내 PC에서 직접 빌드·배포

```bash
npm version patch
set GH_TOKEN=<repo 권한이 있는 GitHub 토큰>
npm run release
git push --follow-tags
```

## 주의

- `package.json`의 `version`이 릴리스 태그(`v0.1.1`)와 같아야 합니다. `npm version`을 쓰면 자동으로 맞춰집니다.
- 이미 올라간 버전 번호를 다시 쓰면 앱이 업데이트로 인식하지 않습니다. 항상 숫자를 올리세요.
- 코드 서명 인증서가 없어서 설치할 때 "Windows의 PC 보호" 안내가 뜹니다 (추가 정보 → 실행).
