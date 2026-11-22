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
  Undo2,
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
import { gesprokenMoment } from './spraakDatum'
import { spokenTekst } from './speech'

// Zo ver (in pixels) veeg je een item naar links om het weg te gooien (F7).
const SWIPE_DELETE = 80
// Pas na zoveel pixels beslissen we of de vinger horizontaal (vegen) of verticaal (scrollen) beweegt.
const SWIPE_LOCK = 10

/** Een melding onderaan; `vast` blijft staan tot je hem sluit (F35). */
/** Hoe lang je weggooien van items ongedaan kunt maken (F8), zoals een lijstje (F12). */
const UNDO_SECONDEN = 10

/** Een veld in het vak van een item waarin je kunt inspreken (F46). */
type Veld = 'tekst' | 'aantal' | 'datum' | 'notitie'

const VELD_NAAM: Record<Veld, string> = {
  tekst: 'Omschrijving',
  aantal: 'Aantal',
  datum: 'Datum',
  notitie: 'Notitie',
}

const VELD_UITLEG: Record<Veld, string> = {
  tekst: 'Zeg wat het item is',
  aantal: 'Zeg het aantal, bijvoorbeeld 3 of 500 gram',
  datum: 'Zeg de datum, bijvoorbeeld morgen of 25 november om 14:30',
  notitie: 'Zeg je notitie',
}

export type Notice = {
  kind: 'ok' | 'error'
  text: string
  vast?: boolean
  /** Hoort bij wat je net typte: de melding staat direct onder het veld (AC43). */
  bijInvoer?: boolean
  /** Hoort bij dit item, dat je in de regel aanpaste: de melding staat eronder (AC43). */
  itemId?: string
  /** Hoort bij het datumveld in het vak van een item (AC43). */
  veld?: 'datum'
}

interface Props {
  lijstje: Lijstje
  notice: Notice | null
  onCloseNotice: () => void
  onAdd: (text: string) => void
  onToggle: (id: string) => void
  /** `false`: de nieuwe tekst staat er al op. */
  onEdit: (id: string, text: string) => boolean
  onRemove: (id: string) => void
  onMove: (from: number, to: number) => void
  onClear: (which: 'af' | 'alles') => void
  /** Zet de items terug zoals ze waren vóór het weggooien (F8). */
  onUndoClear: (items: Item[]) => void
  onBack: () => void
  mic: {
    show: boolean
    listening: boolean
    /** Met `inVak` gaat wat je zegt naar een veld van het open vak (F46). */
    start: (inVak?: (gezegd: string) => void) => void
    stop: () => void
  }
  /** Tekst en kenmerken van een item bewaren uit het vak met de kenmerken (F42). */
  /** `false`: niet bewaard (de tekst staat er al op); het vak blijft open. */
  onDetails: (id: string, tekst: string, details: Details) => boolean
  /**
   * Een nieuw item met kenmerken uit het vak Nieuw item (F42); geeft id en tekst van het nieuwe item, of `null` als
   * het niet kan (de melding staat dan onderaan).
   */
  onAddDetails: (tekst: string, details: Details) => { id: string; tekst: string } | null
  /** Een foutmelding onderaan, bijv. bij een datum die de app niet kent (F33). */
  /** Een foutmelding in het vak; `veld` zegt onder welk veld hij staat (AC43). */
  onFout: (text: string, veld?: 'datum') => void
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
  onEdit: (text: string) => boolean
  /** Een foutmelding onder dit item (AC43). */
  fout: ReactNode
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
  fout,
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
    // Met Enter en een tekst die er al op staat blijft het veld open, met de melding eronder (AC43).
    const goed = text.trim() === item.tekst || onEdit(text)
    if (goed || !e) setEditing(false)
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
        {fout}
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
  onUndoClear,
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
        'datum',
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
      if (!onDetails(detail.id, detail.tekst, details)) return
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
  /** Gooit items weg; 10 seconden lang kan dat ongedaan worden (F8). */
  function clear(which: 'af' | 'alles') {
    const weg = which === 'alles' ? lijstje.items.length : lijstje.items.filter((i) => i.af).length
    setWeggegooid({ items: lijstje.items, aantal: weg })
    onClear(which)
  }

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
  const datumFout = notice?.veld === 'datum'
  // Luistert de microfoon voor het veld Omschr in het vak (F46)?
  const [dicteert, setDicteert] = useState<Veld | null>(null)
  // De items van vóór het weggooien, voor Ongedaan maken; na 10 seconden is het definitief (F8).
  const [weggegooid, setWeggegooid] = useState<{ items: Item[]; aantal: number } | null>(null)
  const [nog, setNog] = useState(UNDO_SECONDEN)
  useEffect(() => {
    if (!weggegooid) return
    setNog(UNDO_SECONDEN)
    const start = Date.now()
    const tick = setInterval(() => setNog(Math.max(0, Math.ceil(UNDO_SECONDEN - (Date.now() - start) / 1000))), 250)
    const timer = setTimeout(() => setWeggegooid(null), UNDO_SECONDEN * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(timer)
    }
  }, [weggegooid])
  useEffect(() => {
    if (!mic.listening) setDicteert(null)
  }, [mic.listening])
  const onderaan = fout ? null : notice

  /** Verwerkt wat je in een veld van het vak insprak (F46). */
  function gezegd(veld: Veld, tekst: string) {
    const t = tekst.trim()
    if (!t) {
      onFout('Ik verstond niets. Probeer het opnieuw.', veld === 'datum' ? 'datum' : undefined)
      return
    }
    if (veld === 'datum') {
      const m = gesprokenMoment(t, zonderJaar)
      if (!m) {
        onFout(
          `Die datum verstond ik niet. Zeg bijvoorbeeld ${tijd ? '25 november om 14:30' : 'morgen of 25 november'}.`,
          'datum',
        )
        return
      }
      setDetail((d) =>
        d
          ? {
              ...d,
              ...(m.datum && { datum: datumTekst(m.datum, zonderJaar) }),
              ...(tijd && m.tijd && { tijd: m.tijd }),
            }
          : d,
      )
      return
    }
    const zonderPunt = t.replace(/[.!?]+$/, '').trim()
    setDetail((d) => {
      if (!d) return d
      if (veld === 'tekst') return { ...d, tekst: spokenTekst([t]) }
      if (veld === 'aantal') return { ...d, aantal: zonderPunt.slice(0, MAX_AANTAL) }
      // Een notitie vult aan wat er al stond; een nieuwe notitie begint met een hoofdletter.
      const oud = d.notitie.trim()
      const zin = oud ? t : t.charAt(0).toLocaleUpperCase('nl') + t.slice(1)
      return { ...d, notitie: (oud ? `${oud} ${zin}` : zin).slice(0, MAX_NOTITIE) }
    })
  }

  /** Een kleine microfoon in een veld van het vak (F46). */
  function veldMic(veld: Veld) {
    if (!mic.show) return null
    const luistert = mic.listening && dicteert === veld
    return (
      <button
        type="button"
        className={luistert ? 'tekst-mic listening' : 'tekst-mic'}
        aria-label={luistert ? 'Stoppen met luisteren' : `${VELD_NAAM[veld]} inspreken`}
        aria-pressed={luistert}
        onClick={(e) => {
          e.preventDefault()
          if (mic.listening) mic.stop()
          else {
            if (fout) onCloseNotice()
            setDicteert(veld)
            mic.start((t) => gezegd(veld, t))
          }
        }}
      >
        <Mic size={17} strokeWidth={2} aria-hidden />
      </button>
    )
  }

  return (
    <main
      className="app list-screen"
      // Een melding bij wat je typte blijft staan tot je weer typt (AC43).
      onInput={() => {
        if (fout) onCloseNotice()
      }}
    >
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
              clear('af')
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
              clear('alles')
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
              {instellen && foutRegel}
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
                <span className="tekst-veld">
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
                  {veldMic('tekst')}
                </span>
              </label>
              {!datumFout && foutRegel}
              {kenmerken.aantal && (
                <label className="field">
                  <span>Aantal</span>
                  <span className="tekst-veld">
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
                    {veldMic('aantal')}
                  </span>
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
                    {veldMic('datum')}
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
              {datum && datumFout && foutRegel}
              {kenmerken.notitie && (
                <label className="field">
                  <span>Notitie</span>
                  <span className="tekst-veld notitie-veld">
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
                    {veldMic('notitie')}
                  </span>
                </label>
              )}
              {detailInAgenda && detailItem?.inAgenda && (
                <p>
                  Staat al in je agenda op {formatWanneer(detailItem.inAgenda, undefined, zonderJaar)}
                  {zonderJaar && ' (elk jaar)'}.
                </p>
              )}
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
            fout={notice?.itemId === item.id && foutRegel}
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
              // Met kenmerken opent tikken in de invoerregel meteen het vak Nieuw item (F42).
              onClick={() => {
                if (metKenmerken && detail === null) startNew('')
              }}
            />
            {mic.show && (
              <button
                type="button"
                className={mic.listening ? 'icon-button mic listening' : 'icon-button mic'}
                aria-label={mic.listening ? 'Stoppen met luisteren' : 'Inspreken'}
                aria-pressed={mic.listening}
                onClick={() => {
                  // Inspreken haalt de melding bij wat je typte weg (AC43).
                  if (mic.listening) mic.stop()
                  else if (metKenmerken) {
                    // Met kenmerken opent het vak Nieuw item en wat je zegt, komt in Omschr (F46).
                    if (fout) onCloseNotice()
                    startNew('')
                    setDicteert('tekst')
                    mic.start((t) => gezegd('tekst', t))
                  } else {
                    if (fout) onCloseNotice()
                    mic.start()
                  }
                }}
              >
                <Mic size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
          </form>
          {!foutInVak && !notice?.itemId && foutRegel}
        </li>
      </ul>

      <div ref={bottom} className="bottom">
        {reminders}
        {mic.listening ? (
          <section className="voice" aria-live="polite">
            <p>
              {dicteert ? (
                <>
                  <strong>Luisteren…</strong> {VELD_UITLEG[dicteert]}
                </>
              ) : (
                <>
                  <strong>Luisteren…</strong> Zeg bijvoorbeeld: melk komma brood komma twee pakken koffie
                </>
              )}
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
        {weggegooid && (
          <section className="voice" aria-live="polite">
            <p role="status">{weggegooid.aantal === 1 ? '1 item' : `${weggegooid.aantal} items`} weggegooid</p>
            <button
              type="button"
              className="undo-button"
              onClick={() => {
                onUndoClear(weggegooid.items)
                setWeggegooid(null)
              }}
            >
              <Undo2 size={18} strokeWidth={1.75} aria-hidden />
              Ongedaan maken
              <span className="undo-count" aria-hidden>
                {nog}
              </span>
            </button>
          </section>
        )}
      </div>
    </main>
  )
}
