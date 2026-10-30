/** Keep the small-screen drawer keyboard reachable without exposing offscreen links. */
export function setupMobileNavigation() {
  const sidebar=document.querySelector<HTMLElement>('.sidebar')!;
  const content=document.querySelector<HTMLElement>('.app-body')!;
  const trigger=document.querySelector<HTMLButtonElement>('.mobile-menu')!;
  const media=matchMedia('(max-width:760px)');
  sidebar.id='main-navigation';
  trigger.setAttribute('aria-controls',sidebar.id);
  trigger.setAttribute('aria-expanded','false');
  const closeButton=document.createElement('button');
  closeButton.className='drawer-close';closeButton.textContent='关闭导航';sidebar.prepend(closeButton);
  const backdrop=document.createElement('button');backdrop.className='drawer-backdrop';backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','关闭导航遮罩');backdrop.hidden=true;sidebar.after(backdrop);
  let open=false;
  function close(restoreFocus=true) {
    open=false;document.body.classList.remove('menu-open');backdrop.hidden=true;
    content.inert=false;sidebar.inert=media.matches;trigger.setAttribute('aria-expanded','false');
    if(restoreFocus)trigger.focus({preventScroll:true});
  }
  trigger.addEventListener('click',()=>{
    if(open){close();return;}
    open=true;sidebar.inert=false;content.inert=true;backdrop.hidden=false;
    document.body.classList.add('menu-open');trigger.setAttribute('aria-expanded','true');
    sidebar.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
  });
  closeButton.addEventListener('click',()=>close());backdrop.addEventListener('click',()=>close());
  sidebar.addEventListener('click',event=>{
    const action=(event.target as HTMLElement).closest('a,button');
    if(open && action && action!==closeButton) close();
  },true);
  document.addEventListener('keydown',event=>{
    if(!open)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const items=Array.from(sidebar.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')).filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  });
  media.addEventListener('change',()=>close(false));close(false);
  return close;
}
