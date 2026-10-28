import styles from './PlanMarkers.module.css'

const COW_BODY = 'M-16.5 -6C-17 -8.8-15 -10-12.5 -9.8C-8 -9-2 -8.4 3 -8.8C7.5 -9.2 10 -7.5 11.5 -5L11.5 5C10 7.5 7.5 9.2 3 8.8C-2 8.4-8 9-12.5 9.8C-15 10-17 8.8-16.5 6Z'

/**
 * Top-down Holstein facing +x (heading 0), centered on the body. The rig rotates toward the walking
 * direction and the head group nods while grazing. Colors come from the parent's --cow-* variables.
 */
export function CowFigure({ shadowId, sheenId, rigTransform }: {
  shadowId: string
  sheenId: string
  rigTransform?: string
}) {
  return <g data-rig="true" transform={rigTransform}>
    <g transform="scale(0.86)">
      <ellipse className={styles.halo} cx="3" cy="0" rx="27" ry="15.5" />
      <ellipse className={styles.shadow} cx="2" cy="2.6" rx="22" ry="12.5" fill={`url(#${shadowId})`} />
      <path className={styles.tail} d="M-16.6 0.2C-19.6 0.6-21.2 2.2-22.2 4.8" />
      <ellipse className={styles.tailTip} cx="-22.4" cy="5.6" rx="1.4" ry="2" />
      <path className={styles.body} d={COW_BODY} />
      <path className={styles.patch} d="M-14 -9.6C-12 -6-9 -3.5-5.5 -5C-3 -6.2-3.5 -8.4-2 -8.6C-6 -9.1-10 -9.6-14 -9.6Z" />
      <path className={styles.patch} d="M-1 8.5C-1.5 5.5 1.5 2.5 4.5 3.5C7 4.3 6.6 7.2 8.6 8.2C5.6 9 2.4 8.7-1 8.5Z" />
      <path className={styles.patch} d="M-9 1C-8 -1.6-4.4 -1.4-4 1C-3.8 3.4-7.4 4.4-8.6 2.8Z" />
      <path className={styles.patch} d="M5 -8.8C5.6 -6 8 -4.8 10.8 -6C9.8 -7.9 7.6 -9 5 -8.8Z" />
      <path className={styles.patch} d="M-16.6 4C-14.6 3.4-12.6 5.4-13.2 8C-13.6 9.4-15.6 9.6-16.6 8.4Z" />
      <path className={styles.sheen} fill={`url(#${sheenId})`} d={COW_BODY} />
      <g data-head="true">
        <path className={styles.ear} d="M12.6 -4.8C11.2 -7.4 11.6 -10.2 13.4 -10.8C15.2 -10.2 15.8 -7.6 14.8 -4.8Z" />
        <path className={styles.ear} d="M12.6 4.8C11.2 7.4 11.6 10.2 13.4 10.8C15.2 10.2 15.8 7.6 14.8 4.8Z" />
        <path className={styles.earInner} d="M13 -5.6C12.4 -7.4 12.8 -9.2 13.6 -9.6C14.4 -9 14.6 -7.4 14.2 -5.6Z" />
        <path className={styles.earInner} d="M13 5.6C12.4 7.4 12.8 9.2 13.6 9.6C14.4 9 14.6 7.4 14.2 5.6Z" />
        <path className={styles.head}
          d="M10 -4.2C12 -5.8 15 -5.8 16.5 -5C19 -4 21.5 -3.6 23 -2.4C24 -1.2 24 1.2 23 2.4C21.5 3.6 19 4 16.5 5C15 5.8 12 5.8 10 4.2Z" />
        <path className={styles.blaze} d="M12.6 -1C15.4 -1.8 18.6 -1.4 20.4 0C18.6 1.4 15.4 1.8 12.6 1Z" />
        <ellipse className={styles.muzzle} cx="22.2" cy="0" rx="2.3" ry="3.2" />
        <circle className={styles.nostril} cx="23.1" cy="-1.2" r="0.55" />
        <circle className={styles.nostril} cx="23.1" cy="1.2" r="0.55" />
      </g>
    </g>
  </g>
}

/** Top-down person (shoulders, head and hands) inside a yellow glass badge. */
export function PersonFigure({ shadowId, rigTransform }: {
  shadowId: string
  rigTransform?: string
}) {
  return <>
    <ellipse className={styles.shadow} cx="1" cy="2.5" rx="17" ry="15" fill={`url(#${shadowId})`} />
    <circle className={styles.badge} r="13" />
    <circle className={styles.badgeRing} r="10.8" />
    <g data-rig="true" transform={rigTransform}>
      <rect className={styles.shoulders} x="-3.4" y="-7.8" width="6" height="15.6" rx="3" />
      <circle className={styles.hand} cx="3.6" cy="-6.6" r="1.7" />
      <circle className={styles.hand} cx="3.6" cy="6.6" r="1.7" />
      <circle className={styles.personHead} cx="0.2" cy="0" r="3.9" />
      <path className={styles.facing} d="M4.6 -1.5L6.8 0L4.6 1.5Z" />
    </g>
  </>
}
