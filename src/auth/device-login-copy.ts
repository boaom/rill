// 设备直连登录指引：手机上没有 DevTools，必须在电脑上取 Cookie 再传回手机。
// 该文件由 LoginPage 动态加载，避免把设备专用长文案塞进 web 主包。
export const DEVICE_LOGIN_GUIDE =
  '在电脑上打开浏览器登录 m.weibo.cn → F12 → Application → Cookies → 复制 SUB、SUBP 等 → 通过任意方式传到手机，粘贴到下面。';
