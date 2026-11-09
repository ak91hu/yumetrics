const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

export function helpMarkup(id, title, message) {
  return `<button type="button" class="help-trigger" popovertarget="${escape(id)}" aria-label="Súgó: ${escape(title)}" aria-describedby="${escape(id)}"><span aria-hidden="true">?</span></button><span id="${escape(id)}" class="context-help" popover="auto" role="note">${escape(message)}</span>`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('toggle', event => {
    const help = event.target;
    if (!help.matches?.('.context-help') || event.newState !== 'open') return;
    const trigger = document.querySelector(`[popovertarget="${CSS.escape(help.id)}"]`);
    const anchor = trigger.getBoundingClientRect(), box = help.getBoundingClientRect();
    const top = anchor.bottom + 8 + box.height <= innerHeight - 12 ? anchor.bottom + 8 : anchor.top - box.height - 8;
    help.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12))}px`;
    help.style.top = `${Math.max(12, Math.min(top, innerHeight - box.height - 12))}px`;
  }, true);
  const dismiss = event => {
    for (const help of document.querySelectorAll('.context-help:popover-open')) if (event.type === 'resize' || !help.contains(event.target)) help.hidePopover();
  };
  document.addEventListener('scroll', dismiss, true);
  window.addEventListener('resize', dismiss);
}
