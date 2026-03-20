document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.tab-btn')
  const contents = document.querySelectorAll<HTMLElement>('.tab-content')

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab
      buttons.forEach(b => b.classList.remove('active'))
      contents.forEach(c => c.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`tab-${target}`)?.classList.add('active')
    })
  })
})
