/** 图标图形集中管理：只放内部静态路径，页面与布局通过 AppIcon 引用。 */
export type IconName =
  | 'home'
  | 'workbench'
  | 'assets'
  | 'plugins'
  | 'settings'
  | 'menu'
  | 'close'
  | 'collapse'
  | 'expand'
  | 'bell'
  | 'index'
  | 'search'
  | 'arrow'

export const ICON_PATHS: Record<IconName, string> = {
  home: '<path d="M3.5 10.6 12 3.5l8.5 7.1"/><path d="M5.5 9.4V20.5h13V9.4"/><path d="M10 20.5v-5.1h4v5.1"/>',
  workbench:
    '<rect x="3.5" y="4.5" width="7" height="15" rx="1.4"/><rect x="13.5" y="4.5" width="7" height="9" rx="1.4"/><path d="M5.6 8.2h2.8M5.6 11h2.8M15.6 8.2h2.8"/>',
  assets:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.8" cy="9.6" r="1.7"/><path d="m5.2 17.2 4.1-4.6 2.9 3 2.4-2.3 4.2 3.9"/>',
  plugins: '<path d="M9 3.4v4.9M15 3.4v4.9"/><path d="M6.4 8.3h11.2v3.1a5.6 5.6 0 0 1-11.2 0z"/><path d="M12 17v3.6"/>',
  settings:
    '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.6v2.1M12 18.3v2.1M4.9 7.5l1.9 1.1M17.2 15.4l1.9 1.1M4.9 16.5l1.9-1.1M17.2 8.6l1.9-1.1"/>',
  menu: '<path d="M4 7.2h16M4 12h16M4 16.8h16"/>',
  close: '<path d="m5.8 5.8 12.4 12.4M18.2 5.8 5.8 18.2"/>',
  collapse: '<path d="M15.2 4.6 7.8 12l7.4 7.4"/>',
  expand: '<path d="M8.8 4.6 16.2 12l-7.4 7.4"/>',
  bell: '<path d="M6.2 9.3a5.8 5.8 0 0 1 11.6 0c0 4.5 1.9 5.8 1.9 5.8H4.3s1.9-1.3 1.9-5.8"/><path d="M9.6 18.4a2.5 2.5 0 0 0 4.8 0"/>',
  index:
    '<rect x="4" y="4" width="6.4" height="6.4" rx="1.2"/><rect x="13.6" y="4" width="6.4" height="6.4" rx="1.2"/><rect x="4" y="13.6" width="6.4" height="6.4" rx="1.2"/><rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.2"/>',
  search: '<circle cx="10.8" cy="10.8" r="5.9"/><path d="m15.2 15.2 4.2 4.2"/>',
  arrow: '<path d="M5.5 12h12.5"/><path d="m13.6 7.5 4.4 4.5-4.4 4.5"/>',
}
