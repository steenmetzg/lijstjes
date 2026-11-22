import { useEffect, useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from 'react'
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  GripVertical,
  Mic,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import {
  AGENDAS,
  agendaLabel,
  datumTekst,
  leesDagMaand,
  formatWanneer,
  leesDatum,
  leesTijd,
  isVoorbij,
  opDatum,
  PER_ITEM,
  zichtbaar,
  type AgendaKeuze,
} from './agenda'
import {
  heeftDatum,
  heeftKenmerken,
  heeftTijd,
  heeftZonderJaar,
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
export type Notice = {
  kind: 'ok' | 'error'
  text: string
  vast?: boolean
  /** Hoort bij wat je net typte: de melding staat direct onder het veld (AC43). */
  bijInvoer?: boolean
}

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
  onBack: () => void
  mic: {
    show: boolean
    listening: boolean
    start: () => void
    stop: () => void
  }
  /** Tekst en kenmerken van een item bewaren uit het vak met de kenmerken (F42). */
  onDetails: (id: string, tekst: string, details: Details) => void
  /**
   * Een nieuw item met kenmerken uit het vak Nieuw item (F42); geeft id en tekst van het nieuwe item, of `null` als
   * het niet kan (de melding staat dan onderaan).
   */
  onAddDetails: (tekst: string, details: Details) => { id: string; tekst: string } | null
  /** Een foutmelding onderaan, bijv. bij een datum die de app niet kent (F33). */
  onFout: (text: string) => void
  /**
   * De agenda van het lijstje kiezen en, met een item, dat item erin zetten met de datum (en tijd) die je ziet (F34).
   * `titel` is de tekst van het item, ook als die net is gewijzigd of het item net is gemaakt.
   */
  onAgenda: (agenda: AgendaKeuze | null, itemId: string | null, wanneer?: string, titel?: string) => void
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
function ItemRow({
  item,
  shift,
  dragging,
  onToggle,
  onEdit,
  onRemove,
  grip,
  opDatum: gesorteerd,
  kenmerken,
  onOpen,
}: RowProps) {
  const [dx, setDx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.tekst)
  const touch = useRef<{ x: number; y: number; dir: 'h' | 'v' | null } | null>(null)
  const wanneer = kenmerken.datum && item.wanneer ? zichtbaar(item.wanneer, kenmerken.tijd) : undefined
  const jaarlijks = kenmerken.zonderJaar
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
          <button
            type="button"
            className="item-text"
            aria-label={`${item.tekst} aanpassen`}
            onClick={onOpen ?? startEditing}
          >
            <span className="item-line">
              {aantal && <span className="item-aantal">{aantal}</span>}
              <span className="item-tekst">{item.tekst}</span>
            </span>
            {wanneer && (
              <span className={isVoorbij(wanneer, undefined, jaarlijks) ? 'item-when past' : 'item-when'}>
                {formatWanneer(wanneer, undefined, jaarlijks)}
                {inAgenda && (
                  <CalendarCheck className="item-in-agenda" size={14} strokeWidth={2} aria-label="staat in je agenda" />
                )}
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

/** Het vak met de kenmerken van een item: wat er in de velden staat. `id` is `null` bij een nieuw item. */
interface Detail {
  id: string | null
  tekst: string
  datum: string
  tijd: string
  notitie: string
  aantal: string
}

/**
 * Een veld om een datum of tijd te typen, met rechts in het veld een icoontje dat de kiezer van de telefoon opent
 * (F33). De kiezer hoort bij een onzichtbaar datum- of tijdveld eronder.
 */
function MomentVeld({
  soort,
  waarde,
  onChange,
  disabled,
  zonderJaar = false,
}: {
  soort: 'datum' | 'tijd'
  /** Datum zonder jaar: alleen dag en maand (F44). */
  zonderJaar?: boolean
  waarde: string
  onChange: (tekst: string) => void
  disabled?: boolean
}) {
  const picker = useRef<HTMLInputElement>(null)
  const datum = soort === 'datum'
  const gelezen = datum ? (zonderJaar ? leesDagMaand(waarde) : leesDatum(waarde)) : leesTijd(waarde)
  return (
    <span className="moment-veld">
      <input
        type="text"
        inputMode="numeric"
        aria-label={datum ? 'Datum' : 'Tijd'}
        placeholder={datum ? (zonderJaar ? 'dd-mm' : 'dd-mm-jjjj') : 'uu:mm'}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={datum ? 10 : 5}
        disabled={disabled}
        value={waarde}
        onChange={(e) => onChange(e.target.value)}
        // Netjes schrijven zodra je het veld verlaat: "2511" wordt "25-11-2026", "930" wordt "09:30".
        onBlur={() => {
          if (gelezen) onChange(datum ? datumTekst(gelezen, zonderJaar) : gelezen)
        }}
      />
      <input
        ref={picker}
        className="moment-kiezer"
        type={datum ? 'date' : 'time'}
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={gelezen ?? ''}
        onChange={(e) =>
          onChange(e.target.value ? (datum ? datumTekst(e.target.value, zonderJaar) : e.target.value) : '')
        }
      />
      <button
        type="button"
        className="moment-open"
        aria-label={datum ? 'Datum kiezen' : 'Tijd kiezen'}
        disabled={disabled}
        onClick={() => openPicker(picker.current)}
      >
        {datum ? (
          <CalendarDays size={17} strokeWidth={1.75} aria-hidden />
        ) : (
          <Clock size={17} strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </span>
  )
}

/** Opent de kiezer van de telefoon (F33). */
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
  onBack,
  mic,
  onDetails,
  onAddDetails,
  onFout,
  onAgenda,
  reminders,
  onInstellen,
}: Props) {
  const [text, setText] = useState('')
  // Naam en kenmerken van het lijstje, via de schuifjesknop (F37, F41).
  const [instellen, setInstellen] = useState<{
    naam: string
    kenmerken: Kenmerken
  } | null>(null)
  // De keuze van de agenda: `voor` is het item dat daarna in de agenda gaat (met `wanneer`), of `null` (F34).
  const [choosing, setChoosing] = useState<{
    voor: string | null
    wanneer?: string
    titel?: string
  } | null>(null)
  // Het vak met de kenmerken van een item (F42).
  const [detail, setDetail] = useState<Detail | null>(null)
  const detailItem = detail ? lijstje.items.find((i) => i.id === detail.id) : undefined
  const datum = heeftDatum(lijstje)
  const tijd = heeftTijd(lijstje)
  const zonderJaar = heeftZonderJaar(lijstje)
  const kenmerken: Required<Kenmerken> = {
    datum,
    zonderJaar,
    tijd,
    notitie: lijstje.kenmerken?.notitie === true,
    aantal: lijstje.kenmerken?.aantal === true,
  }
  const metKenmerken = heeftKenmerken(lijstje)
  // Met Datum staat een lijstje op datum (F33).
  const items = datum ? opDatum(lijstje.items, zonderJaar) : lijstje.items
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

  /** Sluit de open keuzes in de titelbalk; er staat er steeds hoogstens één open. */
  function closeAll() {
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
      datum: w ? datumTekst(w.slice(0, 10), zonderJaar) : '',
      tijd: w.slice(11, 16),
      notitie: item.notitie ?? '',
      aantal: item.aantal ?? '',
    })
  }

  /**
   * De datum en tijd uit het vak; met Tijd uit blijft een eerder ingevulde tijd bewaard (F41, F42). `null` als je
   * een datum of tijd typte die de app niet kent.
   */
  function detailWanneer(d: Detail): string | undefined | null {
    // Zonder jaar: dag en maand van dit jaar; het jaar zie en gebruik je niet (F44).
    const dag = zonderJaar ? leesDagMaand(d.datum) : leesDatum(d.datum)
    const uur = tijd ? leesTijd(d.tijd) : (detailItem?.wanneer?.slice(11, 16) ?? '')
    if (dag === null || uur === null) return null
    if (!dag) return undefined
    return uur ? `${dag}T${uur}` : dag
  }

  /**
   * Bewaart het vak met de kenmerken (of maakt het nieuwe item) en zet het item zo nodig meteen in de agenda
   * (F34, F42).
   */
  function saveDetail(enAgenda: boolean) {
    if (!detail) return
    const wanneer = detailWanneer(detail)
    if (wanneer === null) {
      // Het vak blijft open, zodat je het verbetert.
      onFout(
        (zonderJaar ? leesDagMaand(detail.datum) : leesDatum(detail.datum)) === null
          ? `Die datum ken ik niet. Typ bijvoorbeeld ${zonderJaar ? '25-11' : `25-11-${new Date().getFullYear()}`}.`
          : 'Die tijd ken ik niet. Typ bijvoorbeeld 09:30.',
      )
      return
    }
    const details = { wanneer, notitie: detail.notitie, aantal: detail.aantal }
    let item: { id: string; tekst: string }
    if (detail.id === null) {
      // Een leeg veld of een item dat er al op staat: het vak blijft open, met de melding onderaan.
      const nieuw = onAddDetails(detail.tekst, details)
      if (!nieuw) return
      item = nieuw
      // Klaar voor het volgende item (F3).
      input.current?.focus()
    } else {
      onDetails(detail.id, detail.tekst, details)
      item = {
        id: detail.id,
        tekst: detail.tekst.trim() || (detailItem?.tekst ?? ''),
      }
    }
    setDetail(null)
    if (enAgenda && wanneer) {
      const zien = zichtbaar(wanneer, tijd)
      // Een vaste agenda: meteen erin; nog niets gekozen of Per item kiezen: eerst vragen welke (F34).
      if (lijstje.agenda && lijstje.agenda !== PER_ITEM) onAgenda(lijstje.agenda, item.id, zien, item.tekst)
      else setChoosing({ voor: item.id, wanneer: zien, titel: item.tekst })
    }
  }

  /** Begin je te typen op een lijstje met kenmerken, dan opent het vak Nieuw item met wat je typte (F42). */
  function startNew(value: string) {
    closeAll()
    setDetail({
      id: null,
      tekst: value.slice(0, MAX_TEKST),
      datum: '',
      tijd: '',
      notitie: '',
      aantal: '',
    })
  }

  function choose(agenda: AgendaKeuze) {
    const voor = choosing?.voor ?? null
    const wanneer = choosing?.wanneer
    const titel = choosing?.titel
    setChoosing(null)
    onAgenda(agenda, voor, wanneer, titel)
  }

  const detailZien = detail ? (detailWanneer(detail) ?? undefined) : undefined

  // Staat er een vak open in de titelbalk, dan scrolt het lijstje erachter niet mee.
  const vakOpen = instellen !== null || choosing !== null || detail !== null
  useEffect(() => {
    if (!vakOpen) return
    document.documentElement.classList.add('vak-open')
    return () => document.documentElement.classList.remove('vak-open')
  }, [vakOpen])
  const detailInAgenda = detailItem?.inAgenda && detailZien && zichtbaar(detailZien, tijd) === detailItem.inAgenda

  // Een korte foutmelding staat bij het veld waarin je typt: in het open vak, anders onder de invoerregel (F5).
  const fout = notice && ((notice.kind === 'error' && !notice.vast) || notice.bijInvoer) ? notice.text : null
  const foutRegel = fout && (
    <p className={notice?.kind === 'error' ? 'invoer-fout' : 'invoer-fout ok'} role="status" aria-live="polite">
      {fout}
    </p>
  )
  const foutInVak = instellen !== null || detail !== null
  const onderaan = fout ? null : notice

  return (
    <main className="app list-screen">
      <header ref={header} className="list-header">
        <button type="button" className="back-button" aria-label="Terug naar Mijn lijstjes" onClick={onBack}>
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <h1>
          <span className="title-text">{lijstje.naam}</span>
        </h1>
        <div className="header-actions">
          {/* Naam en kenmerken van het lijstje, links van het prullenbakje (F37, F41). */}
          <button
            type="button"
            className="icon-button"
            aria-label={`Naam en kenmerken van ${lijstje.naam}`}
            aria-expanded={instellen !== null}
            onClick={() => {
              const open = instellen !== null
              closeAll()
              if (!open)
                setInstellen({
                  naam: lijstje.naam,
                  kenmerken: {
                    ...kenmerken,
                    tijd: lijstje.kenmerken?.tijd === true,
                    zonderJaar: lijstje.kenmerken?.zonderJaar === true,
                  },
                })
            }}
          >
            <SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden />
          </button>
          {/* Weggooien zonder vraag, zoals F7: eerst de afgevinkte, dan alle items (F8). */}
          <button
            type="button"
            className="icon-button met-kruisje"
            aria-label="Afgevinkte items weggooien"
            disabled={!hasDone}
            onClick={() => {
              closeAll()
              onClear('af')
            }}
          >
            <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
            <span className="kruisje" aria-hidden>
              <X size={10} strokeWidth={3.5} />
            </span>
          </button>
          <button
            type="button"
            className="icon-button met-kruisje"
            aria-label="Alle items weggooien"
            disabled={items.length === 0}
            onClick={() => {
              closeAll()
              onClear('alles')
            }}
          >
            <Trash2 size={20} strokeWidth={1.75} aria-hidden />
            <span className="kruisje" aria-hidden>
              <X size={10} strokeWidth={3.5} />
            </span>
          </button>
        </div>
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
                  onChange={(e) =>
                    setInstellen({
                      ...instellen,
                      naam: e.target.value.slice(0, MAX_NAAM),
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setInstellen(null)
                  }}
                />
              </label>
              <p className="instellen-uitleg">Extra kenmerken per item</p>
              <div className="kenmerken">
                {KENMERKEN.map((k) => {
                  // Tijd hoort bij een datum: zonder Datum is Tijd uit en niet te kiezen (F41).
                  const uit = (k.id === 'tijd' || k.id === 'zonderJaar') && !instellen.kenmerken.datum
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
                          setInstellen({
                            ...instellen,
                            kenmerken: {
                              ...instellen.kenmerken,
                              [k.id]: e.target.checked,
                            },
                          })
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
              {foutInVak && foutRegel}
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
        {detail && (detail.id === null || detailItem) && (
          <section
            className="confirm clear-choice details"
            aria-label={detailItem ? `Details van ${detailItem.tekst}` : 'Nieuw item'}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveDetail(false)
              }}
            >
              <label className="field">
                <span>Omschr</span>
                <input
                  type="text"
                  aria-label="Tekst"
                  enterKeyHint="done"
                  autoComplete="off"
                  maxLength={MAX_TEKST}
                  // Een nieuw item: verder typen in dit veld (F42).
                  autoFocus={detail.id === null}
                  value={detail.tekst}
                  onChange={(e) =>
                    setDetail({
                      ...detail,
                      tekst: e.target.value.slice(0, MAX_TEKST),
                    })
                  }
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
                    onChange={(e) =>
                      setDetail({
                        ...detail,
                        aantal: e.target.value.slice(0, MAX_AANTAL),
                      })
                    }
                  />
                </label>
              )}
              {datum && (
                // Datum en tijd op één regel; tikken op een veld opent de kiezer van de telefoon (F33).
                <div className="field">
                  <span>Datum</span>
                  <div className={tijd ? 'date-field met-tijd' : 'date-field'}>
                    <MomentVeld
                      soort="datum"
                      zonderJaar={zonderJaar}
                      waarde={detail.datum}
                      onChange={(datum) => setDetail({ ...detail, datum })}
                    />
                    {tijd && (
                      <MomentVeld
                        soort="tijd"
                        waarde={detail.tijd}
                        // Een tijd hoort bij een datum (F41).
                        disabled={!detail.datum}
                        onChange={(t) => setDetail({ ...detail, tijd: t })}
                      />
                    )}
                    <button
                      type="button"
                      className="date-clear"
                      aria-label={tijd ? 'Datum en tijd weghalen' : 'Datum weghalen'}
                      disabled={!detail.datum && !detail.tijd}
                      onClick={() => setDetail({ ...detail, datum: '', tijd: '' })}
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
                    onChange={(e) =>
                      setDetail({
                        ...detail,
                        notitie: e.target.value.slice(0, MAX_NOTITIE),
                      })
                    }
                  />
                </label>
              )}
              {detailInAgenda && detailItem?.inAgenda && (
                <p>
                  Staat al in je agenda op {formatWanneer(detailItem.inAgenda, undefined, zonderJaar)}
                  {zonderJaar && ' (elk jaar)'}.
                </p>
              )}
              {foutInVak && foutRegel}
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
              // Elk item mag maximaal 60 tekens hebben, ook als je er meerdere met komma's typt (F3, F4). Met kenmerken
              // opent het eerste teken het vak Nieuw item, waarin je verder typt (F42).
              onChange={(e) => {
                if (metKenmerken && e.target.value.trim()) {
                  setText('')
                  startNew(e.target.value)
                } else setText(limitTyped(e.target.value))
              }}
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
          {!foutInVak && foutRegel}
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
          onderaan && (
            <section className={onderaan.kind === 'error' ? 'voice error' : 'voice'} aria-live="polite">
              <p role="status">{onderaan.text}</p>
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
