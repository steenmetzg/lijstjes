import { useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from 'react'
import { ArrowLeft, CalendarCheck, CalendarDays, Check, Clock, GripVertical, Mic, Pencil, Trash2, X } from 'lucide-react'
import { AGENDAS, agendaLabel, formatWanneer, isVoorbij, opDatum, PER_ITEM, zichtbaar, type AgendaKeuze } from './agenda'
import {
  heeftDatum,
  heeftKenmerken,
  heeftTijd,
  KENMERKEN,
  limitTyped,
  MAX_AANTAL,
  MAX_NAAM,
  MAX_NOTITIE,
  MAX_TEKST,
  staatInAgenda,
  type Details,
  type Item,
  type Kenmerken,
  type Lijstje,
} from './lists'
import { MoreAbove, MoreBelow } from './MoreItems'
import { useScrollList, type Grip } from './scrollList'

// Zo ver (in pixels) veeg je een item naar links om het weg te gooien (F7).
const SWIPE_DELETE = 80
// Pas na zoveel pixels beslissen we of de vinger horizontaal (vegen) of verticaal (scrollen) beweegt.
const SWIPE_LOCK = 10

/** Een melding onderaan; `vast` blijft staan tot je hem sluit (F35). */
export type Notice = { kind: 'ok' | 'error'; text: string; vast?: boolean }

interface Props {
  lijstje: Lijstje
  notice: Notice | null
  onCloseNotice: () => void
  onAdd: (text: string) => void
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
  onClear: (which: 'af' | 'alles') => void
  /** Gooit de items én het lijstje zelf weg; `null` als dit het laatste lijstje is (F8). */
  onDeleteList: (() => void) | null
  onBack: () => void
  mic: { show: boolean; listening: boolean; start: () => void; stop: () => void }
  /** Tekst en kenmerken van een item bewaren uit het vak met de kenmerken (F42). */
  onDetails: (id: string, tekst: string, details: Details) => void
  /**
   * De agenda van het lijstje kiezen en, met een item, dat item erin zetten met de datum (en tijd) die je ziet (F34).
   */
  onAgenda: (agenda: AgendaKeuze | null, itemId: string | null, wanneer?: string) => void
  /** De melding met herinneringen (F36). */
  reminders?: ReactNode
  /** Nieuwe naam en kenmerken voor het lijstje; `false` als de naam niet kan (de melding staat dan onderaan) (F37, F41). */
  onInstellen: (naam: string, kenmerken: Kenmerken) => boolean
}

interface RowProps {
  item: Item
  /** Hoeveel pixels de regel omhoog of omlaag staat tijdens het verslepen. */
  shift: number
  dragging: boolean
  onToggle: () => void
  onEdit: (text: string) => void
  onRemove: () => void
  grip: Grip
  /** Op datum gesorteerd: geen greep om te verplaatsen (F33). */
  opDatum: boolean
  /** De kenmerken die aan staan (Tijd alleen samen met Datum). */
  kenmerken: Required<Kenmerken>
  /** Opent het vak met de kenmerken (F42); zonder kenmerken pas je de tekst in de regel zelf aan (F27). */
  onOpen: (() => void) | null
}

/**
 * Eén item: vastpakken om te verplaatsen (F28), het rondje om af te vinken (F6), de tekst om aan te passen (F27,
 * F42), het kruisje of naar links vegen om weg te gooien (F7). Met kenmerken ook het aantal, de datum en de notitie.
 */
function ItemRow({ item, shift, dragging, onToggle, onEdit, onRemove, grip, opDatum: gesorteerd, kenmerken, onOpen }: RowProps) {
  const [dx, setDx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.tekst)
  const touch = useRef<{ x: number; y: number; dir: 'h' | 'v' | null } | null>(null)
  const wanneer = kenmerken.datum && item.wanneer ? zichtbaar(item.wanneer, kenmerken.tijd) : undefined
  const inAgenda = kenmerken.datum && staatInAgenda(item, kenmerken.tijd)
  const aantal = kenmerken.aantal ? item.aantal : undefined
  const notitie = kenmerken.notitie ? item.notitie : undefined

  function onTouchStart(e: TouchEvent) {
    if (editing) return
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, dir: null }
  }

  function onTouchMove(e: TouchEvent) {
    const start = touch.current
    if (!start) return
    const t = e.touches[0]
    const x = t.clientX - start.x
    const y = t.clientY - start.y
    if (!start.dir) {
      if (Math.abs(x) < SWIPE_LOCK && Math.abs(y) < SWIPE_LOCK) return
      start.dir = Math.abs(x) > Math.abs(y) ? 'h' : 'v'
    }
    if (start.dir === 'h') setDx(Math.min(0, x))
  }

  function onTouchEnd() {
    const swiped = touch.current?.dir === 'h' && dx <= -SWIPE_DELETE
    touch.current = null
    setDx(0)
    if (swiped) onRemove()
  }

  function startEditing() {
    setText(item.tekst)
    setEditing(true)
  }

  function save(e?: FormEvent) {
    e?.preventDefault()
    if (!editing) return
    setEditing(false)
    if (text.trim() !== item.tekst) onEdit(text)
  }

  const style = dx
    ? { transform: `translateX(${dx}px)`, transition: 'none' }
    : dragging
      ? { transform: `translateY(${shift}px)`, transition: 'none' }
      : shift
        ? { transform: `translateY(${shift}px)` }
        : undefined

  return (
    <li
      className={['item', item.af && 'done', dragging && 'dragging'].filter(Boolean).join(' ')}
      data-id={item.id}
      style={style}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touch.current = null
        setDx(0)
      }}
    >
      {gesorteerd ? (
        // Op datum gesorteerd; verplaatsen kan dan niet (F33).
        <span className="item-grip" aria-hidden />
      ) : (
        <button
          type="button"
          className="item-grip"
          aria-label={`${item.tekst} verplaatsen`}
          aria-description="Sleep omhoog of omlaag, of gebruik de pijltjestoetsen"
          // Vastpakken is geen vegen om weg te gooien.
          onTouchStart={(e) => e.stopPropagation()}
          {...grip}
        >
          <GripVertical size={18} strokeWidth={1.75} aria-hidden />
        </button>
      )}
      <button type="button" className="item-check" aria-label={item.tekst} aria-pressed={item.af} onClick={onToggle}>
        <span className="check" aria-hidden>
          {item.af && <Check size={16} strokeWidth={2.5} />}
        </span>
      </button>
      <div className="item-body">
        {editing ? (
          <form className="item-edit" onSubmit={save}>
            <input
              type="text"
              aria-label="Item aanpassen"
              enterKeyHint="done"
              autoComplete="off"
              autoFocus
              maxLength={MAX_TEKST}
              value={text}
              // Ook hier zelf afkappen: het toetsenbord van Android houdt zich niet altijd aan maxLength (F27).
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEKST))}
              onBlur={() => save()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          </form>
        ) : (
          <button type="button" className="item-text" aria-label={`${item.tekst} aanpassen`} onClick={onOpen ?? startEditing}>
            <span className="item-line">
              {aantal && <span className="item-aantal">{aantal}</span>}
              <span className="item-tekst">{item.tekst}</span>
            </span>
            {wanneer && (
              <span className={isVoorbij(wanneer) ? 'item-when past' : 'item-when'}>
                {formatWanneer(wanneer)}
                {inAgenda && <CalendarCheck className="item-in-agenda" size={14} strokeWidth={2} aria-label="staat in je agenda" />}
              </span>
            )}
            {notitie && <span className="item-note">{notitie}</span>}
          </button>
        )}
      </div>
      <button type="button" className="item-delete" aria-label={`${item.tekst} weggooien`} onClick={onRemove}>
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </li>
  )
}

/** Het vak met de kenmerken van een item: wat er in de velden staat. */
interface Detail {
  id: string
  tekst: string
  datum: string
  tijd: string
  notitie: string
  aantal: string
}

/** Opent de kiezer van de telefoon; Android toont in het veld zelf alleen een pijltje (F33). */
function openPicker(input: HTMLInputElement | null) {
  if (!input) return
  try {
    input.showPicker()
  } catch {
    input.focus()
  }
}

/** Het scherm van één lijstje (F1 t/m F8, F15, F27, F28, F41, F42). */
export default function ListView({
  lijstje,
  notice,
  onCloseNotice,
  onAdd,
  onToggle,
  onEdit,
  onRemove,
  onMove,
  onClear,
  onDeleteList,
  onBack,
  mic,
  onDetails,
  onAgenda,
  reminders,
  onInstellen,
}: Props) {
  const [text, setText] = useState('')
  const [clearing, setClearing] = useState(false)
  // Naam en kenmerken van het lijstje, via de titel met het potloodje (F37, F41).
  const [instellen, setInstellen] = useState<{ naam: string; kenmerken: Kenmerken } | null>(null)
  // De keuze van de agenda: `voor` is het item dat daarna in de agenda gaat (met `wanneer`), of `null` (F34).
  const [choosing, setChoosing] = useState<{ voor: string | null; wanneer?: string } | null>(null)
  // Het vak met de kenmerken van een item (F42).
  const [detail, setDetail] = useState<Detail | null>(null)
  const detailItem = detail ? lijstje.items.find((i) => i.id === detail.id) : undefined
  const dateInput = useRef<HTMLInputElement>(null)
  const timeInput = useRef<HTMLInputElement>(null)
  const datum = heeftDatum(lijstje)
  const tijd = heeftTijd(lijstje)
  const kenmerken: Required<Kenmerken> = {
    datum,
    tijd,
    notitie: lijstje.kenmerken?.notitie === true,
    aantal: lijstje.kenmerken?.aantal === true,
  }
  const metKenmerken = heeftKenmerken(lijstje)
  // Met Datum staat een lijstje op datum (F33).
  const items = datum ? opDatum(lijstje.items) : lijstje.items
  const hasDone = items.some((i) => i.af)
  const input = useRef<HTMLInputElement>(null)
  const scroll = useScrollList(items, datum ? () => {} : onMove)
  const { header, list, addRow, bottom, hidden } = scroll

  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim()) onAdd(text)
    setText('')
    // Het veld blijft geselecteerd, zodat je meteen het volgende item typt (F3).
    input.current?.focus()
  }

  function clear(which: 'af' | 'alles') {
    onClear(which)
    setClearing(false)
  }

  /** Sluit de open keuzes in de titelbalk; er staat er steeds hoogstens één open. */
  function closeAll() {
    setClearing(false)
    setChoosing(null)
    setDetail(null)
    setInstellen(null)
  }

  function openDetail(item: Item) {
    closeAll()
    const w = item.wanneer ?? ''
    setDetail({
      id: item.id,
      tekst: item.tekst,
      datum: w.slice(0, 10),
      tijd: w.slice(11, 16),
      notitie: item.notitie ?? '',
      aantal: item.aantal ?? '',
    })
  }

  /** De datum en tijd uit het vak; met Tijd uit blijft een eerder ingevulde tijd bewaard (F41, F42). */
  function detailWanneer(d: Detail): string | undefined {
    if (!d.datum) return undefined
    const t = tijd ? d.tijd : (detailItem?.wanneer?.slice(11, 16) ?? '')
    return t ? `${d.datum}T${t}` : d.datum
  }

  /** Bewaart het vak met de kenmerken en zet het item zo nodig meteen in de agenda (F34, F42). */
  function saveDetail(enAgenda: boolean) {
    if (!detail) return
    const wanneer = detailWanneer(detail)
    setDetail(null)
    onDetails(detail.id, detail.tekst, { wanneer, notitie: detail.notitie, aantal: detail.aantal })
    if (enAgenda && wanneer) {
      const zien = zichtbaar(wanneer, tijd)
      // Een vaste agenda: meteen erin; nog niets gekozen of Per item kiezen: eerst vragen welke (F34).
      if (lijstje.agenda && lijstje.agenda !== PER_ITEM) onAgenda(lijstje.agenda, detail.id, zien)
      else setChoosing({ voor: detail.id, wanneer: zien })
    }
  }

  function choose(agenda: AgendaKeuze) {
    const voor = choosing?.voor ?? null
    const wanneer = choosing?.wanneer
    setChoosing(null)
    onAgenda(agenda, voor, wanneer)
  }

  const detailZien = detail ? detailWanneer(detail) : undefined
  const detailInAgenda = detailItem?.inAgenda && detailZien && zichtbaar(detailZien, tijd) === detailItem.inAgenda

  return (
    <main className="app list-screen">
      <header ref={header} className="list-header">
        <button type="button" className="back-button" aria-label="Terug naar Mijn lijstjes" onClick={onBack}>
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <h1>
          <button
            type="button"
            className="title-button"
            aria-label={`Naam en kenmerken van ${lijstje.naam}`}
            aria-expanded={instellen !== null}
            onClick={() => {
              const open = instellen !== null
              closeAll()
              if (!open) setInstellen({ naam: lijstje.naam, kenmerken: { ...kenmerken, tijd: lijstje.kenmerken?.tijd === true } })
            }}
          >
            <span className="title-text">{lijstje.naam}</span>
            <Pencil className="title-pencil" size={15} strokeWidth={1.75} aria-hidden />
          </button>
        </h1>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Lijstje weggooien"
            aria-expanded={clearing}
            disabled={items.length === 0 && !onDeleteList}
            onClick={() => {
              const open = clearing
              closeAll()
              setClearing(!open)
            }}
          >
            <Trash2 size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {/* De keuzes staan in de vaste titelbalk, zodat ze ook in beeld komen als je omlaag gescrold bent (F8). */}
        {clearing && (
          <section className="confirm clear-choice" aria-label="Lijstje weggooien">
            <strong>Lijstje {lijstje.naam} weggooien</strong>
            <div className="confirm-buttons">
              <button type="button" disabled={!hasDone} onClick={() => clear('af')}>
                Afgevinkte weggooien
              </button>
              <button type="button" className="confirm-yes" disabled={items.length === 0} onClick={() => clear('alles')}>
                Alle items weggooien
              </button>
              <button type="button" className="wide" disabled={!onDeleteList} onClick={() => onDeleteList?.()}>
                Items én het lijstje weggooien
              </button>
              <button type="button" className="cancel" onClick={() => setClearing(false)}>
                Annuleren
              </button>
            </div>
          </section>
        )}
        {instellen && (
          <section className="confirm clear-choice instellen" aria-label="Lijstje aanpassen">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                // Een goede naam: bewaren en sluiten; anders blijft het vak open met de melding onderaan (F37).
                if (onInstellen(instellen.naam, instellen.kenmerken)) setInstellen(null)
              }}
            >
              <label className="field">
                <span>Naam</span>
                <input
                  type="text"
                  aria-label="Naam van het lijstje"
                  enterKeyHint="done"
                  autoComplete="off"
                  maxLength={MAX_NAAM}
                  value={instellen.naam}
                  onChange={(e) => setInstellen({ ...instellen, naam: e.target.value.slice(0, MAX_NAAM) })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setInstellen(null)
                  }}
                />
              </label>
              <p className="instellen-uitleg">Extra kenmerken per item</p>
              <div className="kenmerken">
                {KENMERKEN.map((k) => {
                  // Tijd hoort bij een datum: zonder Datum is Tijd uit en niet te kiezen (F41).
                  const uit = k.id === 'tijd' && !instellen.kenmerken.datum
                  return (
                    <label key={k.id} className={uit ? 'kenmerk off' : 'kenmerk'}>
                      <span>{k.label}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        className="herinnering-switch"
                        aria-label={k.label}
                        checked={!uit && instellen.kenmerken[k.id] === true}
                        disabled={uit}
                        onChange={(e) =>
                          setInstellen({ ...instellen, kenmerken: { ...instellen.kenmerken, [k.id]: e.target.checked } })
                        }
                      />
                    </label>
                  )
                })}
              </div>
              {instellen.kenmerken.datum && lijstje.agenda && (
                <p className="instellen-agenda">
                  Agenda: {lijstje.agenda === PER_ITEM ? 'per item kiezen' : agendaLabel(lijstje.agenda)}{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setInstellen(null)
                      setChoosing({ voor: null })
                    }}
                  >
                    Wijzigen
                  </button>
                </p>
              )}
              <div className="confirm-buttons">
                <button type="button" className="cancel-half" onClick={() => setInstellen(null)}>
                  Annuleren
                </button>
                <button type="submit" className="confirm-yes">
                  Bewaren
                </button>
              </div>
            </form>
          </section>
        )}
        {detail && detailItem && (
          <section className="confirm clear-choice details" aria-label={`Details van ${detailItem.tekst}`}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveDetail(false)
              }}
            >
              <label className="field">
                <span>Item</span>
                <input
                  type="text"
                  aria-label="Tekst"
                  enterKeyHint="done"
                  autoComplete="off"
                  maxLength={MAX_TEKST}
                  value={detail.tekst}
                  onChange={(e) => setDetail({ ...detail, tekst: e.target.value.slice(0, MAX_TEKST) })}
                />
              </label>
              {kenmerken.aantal && (
                <label className="field">
                  <span>Aantal</span>
                  <input
                    type="text"
                    aria-label="Aantal"
                    placeholder="bijv. 2 of 500 g"
                    enterKeyHint="done"
                    autoComplete="off"
                    maxLength={MAX_AANTAL}
                    value={detail.aantal}
                    onChange={(e) => setDetail({ ...detail, aantal: e.target.value.slice(0, MAX_AANTAL) })}
                  />
                </label>
              )}
              {datum && (
                <div className="field">
                  <span>Datum</span>
                  <div className="date-field">
                    <input
                      ref={dateInput}
                      type="date"
                      aria-label="Datum"
                      value={detail.datum}
                      onChange={(e) => setDetail({ ...detail, datum: e.target.value })}
                    />
                    <button type="button" className="date-clear date-open" aria-label="Datum kiezen" onClick={() => openPicker(dateInput.current)}>
                      <CalendarDays size={18} strokeWidth={1.75} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="date-clear"
                      aria-label="Datum weghalen"
                      disabled={!detail.datum}
                      onClick={() => setDetail({ ...detail, datum: '', tijd: '' })}
                    >
                      <X size={18} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
              {tijd && (
                <div className="field">
                  <span>Tijd</span>
                  <div className="date-field">
                    <input
                      ref={timeInput}
                      type="time"
                      aria-label="Tijd"
                      // Een tijd hoort bij een datum (F41).
                      disabled={!detail.datum}
                      value={detail.tijd}
                      onChange={(e) => setDetail({ ...detail, tijd: e.target.value })}
                    />
                    <button
                      type="button"
                      className="date-clear date-open"
                      aria-label="Tijd kiezen"
                      disabled={!detail.datum}
                      onClick={() => openPicker(timeInput.current)}
                    >
                      <Clock size={18} strokeWidth={1.75} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="date-clear"
                      aria-label="Tijd weghalen"
                      disabled={!detail.tijd}
                      onClick={() => setDetail({ ...detail, tijd: '' })}
                    >
                      <X size={18} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
              {kenmerken.notitie && (
                <label className="field">
                  <span>Notitie</span>
                  <textarea
                    aria-label="Notitie"
                    rows={3}
                    maxLength={MAX_NOTITIE}
                    value={detail.notitie}
                    onChange={(e) => setDetail({ ...detail, notitie: e.target.value.slice(0, MAX_NOTITIE) })}
                  />
                </label>
              )}
              {detailInAgenda && detailItem.inAgenda && <p>Staat al in je agenda op {formatWanneer(detailItem.inAgenda)}.</p>}
              <div className="confirm-buttons">
                {datum && (
                  <button
                    type="button"
                    className="wide"
                    // Zonder datum kan het niet; met dezelfde datum zou er een tweede agenda-item komen (F34).
                    disabled={!detail.datum || Boolean(detailInAgenda)}
                    onClick={() => saveDetail(true)}
                  >
                    In agenda zetten
                  </button>
                )}
                <button type="button" className="cancel-half" onClick={() => setDetail(null)}>
                  Annuleren
                </button>
                <button type="submit" className="confirm-yes">
                  Bewaren
                </button>
              </div>
            </form>
          </section>
        )}
        {choosing && (
          <section className="confirm clear-choice agenda-choice" aria-label="Agenda kiezen">
            <strong>{choosing.voor ? 'In welke agenda?' : `Agenda voor ${lijstje.naam}`}</strong>
            <p>
              {choosing.voor && lijstje.agenda === PER_ITEM
                ? 'Kies waar je dit item ook op wilt nemen.'
                : `Datums worden altijd in Lijstjes getoond. Kies hieronder waar je ze ook op wilt nemen. Je keuze geldt alleen voor dit lijstje (${lijstje.naam}).`}
            </p>
            <div className="confirm-buttons">
              {AGENDAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={!choosing.voor && lijstje.agenda === a.id ? 'confirm-yes' : undefined}
                  aria-pressed={!choosing.voor ? lijstje.agenda === a.id : undefined}
                  onClick={() => choose(a.id)}
                >
                  {a.label}
                </button>
              ))}
              {choosing.voor ? (
                <button type="button" className="cancel-half" onClick={() => setChoosing(null)}>
                  Annuleren
                </button>
              ) : (
                // Geen vaste agenda: bij elk item vragen welke (F34). Precies één van de zes is gekozen.
                <button
                  type="button"
                  className={lijstje.agenda === PER_ITEM ? 'confirm-yes' : undefined}
                  aria-pressed={lijstje.agenda === PER_ITEM}
                  onClick={() => choose(PER_ITEM)}
                >
                  Per item kiezen
                </button>
              )}
            </div>
          </section>
        )}
      </header>

      <MoreAbove
        count={hidden.above}
        words={['item', 'items']}
        headerHeight={scroll.headerHeight}
        onClick={() => scroll.scrollPage(-1)}
      />

      <ul
        ref={list}
        className="items"
        aria-label={`Items op ${lijstje.naam}`}
        // Na verplaatsen schuiven de regels nog even naar hun plek; daarna opnieuw tellen (F29).
        onTransitionEnd={scroll.measure}
      >
        {items.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            shift={scroll.shiftFor(index)}
            dragging={scroll.draggingId === item.id}
            onToggle={() => onToggle(item.id)}
            onEdit={(t) => onEdit(item.id, t)}
            onRemove={() => onRemove(item.id)}
            grip={scroll.gripFor(item.id, index)}
            opDatum={datum}
            kenmerken={kenmerken}
            onOpen={metKenmerken ? () => openDetail(item) : null}
          />
        ))}
        {/* De invoerregel staat als laatste regel in het lijstje (F3, F15). */}
        <li
          ref={addRow}
          className={hidden.below > 0 ? 'item add-row covering' : 'item add-row'}
          style={{ bottom: scroll.bottomHeight }}
        >
          <MoreBelow count={hidden.below} words={['item', 'items']} onClick={() => scroll.scrollPage(1)} />
          <span className="item-grip" aria-hidden />
          <span className="item-check" aria-hidden>
            <span className="check" />
          </span>
          <form className="add-item" onSubmit={submit}>
            <input
              ref={input}
              type="text"
              aria-label="Item toevoegen"
              placeholder="Item toevoegen"
              enterKeyHint="enter"
              autoComplete="off"
              value={text}
              // Elk item mag maximaal 60 tekens hebben, ook als je er meerdere met komma's typt (F3, F4).
              onChange={(e) => setText(limitTyped(e.target.value))}
            />
            {mic.show && (
              <button
                type="button"
                className={mic.listening ? 'icon-button mic listening' : 'icon-button mic'}
                aria-label={mic.listening ? 'Stoppen met luisteren' : 'Inspreken'}
                aria-pressed={mic.listening}
                onClick={mic.listening ? mic.stop : mic.start}
              >
                <Mic size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
          </form>
        </li>
      </ul>

      <div ref={bottom} className="bottom">
        {reminders}
        {mic.listening ? (
          <section className="voice" aria-live="polite">
            <p>
              <strong>Luisteren…</strong> Zeg bijvoorbeeld: melk komma brood komma twee pakken koffie
            </p>
          </section>
        ) : (
          notice && (
            <section className={notice.kind === 'error' ? 'voice error' : 'voice'} aria-live="polite">
              <p role="status">{notice.text}</p>
              <button type="button" className="voice-close" aria-label="Melding sluiten" onClick={onCloseNotice}>
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </section>
          )
        )}
      </div>
    </main>
  )
}
