import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../../api'

const th = { border: '1px solid #ccc', padding: 10, textAlign: 'left' }
const td = { border: '1px solid #eee', padding: 10 }
const btn = { width: 28, height: 28, margin: '0 4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }
const delBtn = { ...btn, width: 30, background: '#ff4d4f', color: '#fff', border: 'none' }
const sellBtn = { background: '#27ae60', color: '#fff', padding: '10px 20px', fontSize: 16, border: 'none', cursor: 'pointer' }

const Kassa = () => {
  const [goods, setGoods] = useState([])
  const [sales, setSales] = useState([])
  const [cart, setCart] = useState([])
  const [payment, setPay] = useState('cash')
  const [query, setQuery] = useState('')
  const [suggest, setSuggest] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [multipleMatches, setMultipleMatches] = useState(null)

  const scanRef = useRef()
  const nameRef = useRef()
  const nav = useNavigate()
  const total = cart.reduce((s, i) => s + i.qty * +i.price, 0)

  useEffect(() => {
    API.getStocks()
      .then(r => {
        const enriched = r.data.map(g => ({
          ...g,
          code_array: g.code.split(',').map(c => c.trim())
        }))
        setGoods(enriched)
      })
      .catch(e => console.error('Ошибка загрузки товаров', e))

    API.getSales().then(r => setSales(r.data))
  }, [])

  const handleScan = e => {
    if (e.key !== 'Enter') return
    const code = e.target.value.trim()
    if (!code) return

    const matches = goods.filter(g => g.code_array.includes(code))

    if (matches.length === 0) {
      alert('Товар не найден')
    } else if (matches.length === 1) {
      addToCart(matches[0])
    } else {
      setMultipleMatches(matches)
    }

    e.target.value = ''
  }

  const handleNameChange = e => {
    const val = e.target.value
    setQuery(val)
    if (val.length < 2) {
      setSuggest([])
      return
    }

    const re = new RegExp(val, 'i')
    setSuggest(goods.filter(g => re.test(g.name)).slice(0, 8))
    setHighlight(-1)
  }

  const keyNav = e => {
    if (!suggest.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % suggest.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h - 1 + suggest.length) % suggest.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = suggest[highlight >= 0 ? highlight : 0]
      if (item) { addToCart(item); clearSuggest() }
    }
  }

  const chooseSuggest = i => {
    addToCart(suggest[i])
    clearSuggest()
    nameRef.current.focus()
  }

  const clearSuggest = () => {
    setQuery('')
    setSuggest([])
    setHighlight(-1)
  }

  const addToCart = item => {
    setCart(prev => {
      const ex = prev.find(p => p.id === item.id)
      return ex
        ? prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p)
        : [...prev, { ...item, qty: 1 }]
    })
  }

  const changeQty = (i, d) =>
    setCart(p => p.map((r, idx) =>
      idx === i ? { ...r, qty: Math.max(1, r.qty + d) } : r))

  const setQtyManual = (i, v) =>
    setCart(p => p.map((r, idx) =>
      idx === i ? { ...r, qty: Math.max(1, parseInt(v) || 1) } : r))

  const updatePrice = (i, value) =>
    setCart(p => p.map((r, idx) =>
      idx === i ? { ...r, price: parseFloat(value) || 0 } : r))

  const removeRow = idx => setCart(p => p.filter((_, i) => i !== idx))

  const handleSell = async () => {
    if (!cart.length) return alert('Корзина пуста')
    try {
      if (!localStorage.getItem('kassa-id')) {
        alert('Сначала откройте кассу')
        return
      }
      const payload = {
        total: total.toFixed(2),
        payment_type: payment,
        items: cart.map(i => ({
          code: i.code,
          name: i.name,
          price: +i.price,
          quantity: i.qty,
          total: (+i.price * i.qty).toFixed(2)
        }))
      }
      const res = await API.createSale(payload)
      localStorage.setItem('receipt', JSON.stringify(res.data))
      setCart([])
      nav('/receipt')
    } catch (e) {
      console.error(e)
      alert('Ошибка при продаже')
    }
  }

  const openKassa = () => {
    API.openKassa(0).then(res => {
      if (res.status === 201) {
        localStorage.setItem('kassa-id', res.data.id)
        nav('/kassa-report')
      }
    })
  }

  const closeKassa = () => {
    const today = new Date().toISOString().slice(0, 10)
    const summa = sales.filter(s => (s.date || '').slice(0, 10) === today)
      .reduce((t, i) => t + Number(i.total || 0), 0)
    const id = localStorage.getItem('kassa-id')
    API.kassaItem(id).then(_ => {
      API.closeKassa(id, summa).then(res => {
        if (res.status === 200) {
          localStorage.setItem('kassa-item', JSON.stringify(res.data))
          nav('/kassa-report')
        }
      })
      localStorage.removeItem('kassa-id')
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>🧾 Касса</h2>

      <input ref={scanRef} onKeyDown={handleScan}
        placeholder="Сканируйте штрих-код…"
        style={{ width: '100%', padding: 12, fontSize: 16, marginBottom: 20 }} />

      <div style={{ position: 'relative' }}>
        <input ref={nameRef}
          value={query}
          onChange={handleNameChange}
          onKeyDown={keyNav}
          placeholder="Название товара…"
          style={{ width: '100%', padding: 12, fontSize: 16, marginBottom: 20 }} />

        {suggest.length > 0 && (
          <ul style={{
            position: 'absolute', zIndex: 1000, top: 48, left: 0, right: 0,
            maxHeight: 180, overflowY: 'auto',
            background: '#fff', border: '1px solid #ccc', listStyle: 'none', margin: 0, padding: 0
          }}>
            {suggest.map((s, i) => (
              <li key={s.id}
                onMouseDown={() => chooseSuggest(i)}
                style={{
                  padding: '6px 12px', cursor: 'pointer',
                  background: i === highlight ? '#f0f8ff' : 'transparent'
                }}>
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Тип оплаты:&nbsp;</label>
        <select value={payment} onChange={e => setPay(e.target.value)} style={{ padding: 6 }}>
          <option value="cash">Наличные</option>
          <option value="card">Карта</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead style={{ background: '#f0f0f0' }}>
          <tr>
            <th style={th}>Название</th>
            <th style={th}>Цена</th>
            <th style={th}>Кол-во</th>
            <th style={th}>Сумма</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {cart.map((it, idx) => (
            <tr key={idx}>
              <td style={td}>{it.name}</td>
              <td style={td}>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={it.price}
                  onChange={e => updatePrice(idx, e.target.value)}
                  style={{ width: 70, textAlign: 'center' }}
                />
              </td>
              <td style={td}>
                <button onClick={() => changeQty(idx, -1)} style={btn}>−</button>
                <input type="number" min={1} value={it.qty}
                  onChange={e => setQtyManual(idx, e.target.value)}
                  style={{ width: 50, textAlign: 'center' }} />
                <button onClick={() => changeQty(idx, 1)} style={btn}>+</button>
                <div style={{ fontSize: 11, color: '#888' }}>
                  Остаток: {it.quantity - it.qty}
                </div>
              </td>
              <td style={td}>{(it.qty * +it.price).toFixed(2)} сом</td>
              <td style={td}>
                <button onClick={() => removeRow(idx)} style={delBtn}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ textAlign: 'right' }}>Итого: {total.toFixed(2)} сом</h3>

      <div style={{ textAlign: 'right' }}>
        <button onClick={handleSell} style={sellBtn}>✅ Продать</button>
      </div>

      <div style={{ textAlign: 'right', marginTop: 20 }}>
        {localStorage.getItem('kassa-id')
          ? <button onClick={closeKassa} style={sellBtn}>Закрыть кассу</button>
          : <button onClick={openKassa} style={sellBtn}>Открыть кассу</button>}
      </div>

      {multipleMatches && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            background: '#fff', padding: 20, borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)', minWidth: 300
          }}>
            <h3>Выберите товар:</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {multipleMatches.map((item, idx) => (
                <li key={item.id} style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => {
                      addToCart(item)
                      setMultipleMatches(null)
                    }}
                    style={{
                      padding: '10px 12px', width: '100%', textAlign: 'left',
                      background: '#f8f8f8', border: '1px solid #ccc',
                      cursor: 'pointer', borderRadius: 4
                    }}
                  >
                    {item.name} — {item.price} сом
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setMultipleMatches(null)}
                style={{
                  marginTop: 10, background: 'transparent',
                  border: 'none', color: '#888', cursor: 'pointer'
                }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Kassa