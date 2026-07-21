import {useCallback} from 'react'
import {set, unset, useFormValue} from 'sanity'

export function DayPicker(props: any) {
  const {value, onChange} = props

  const month = useFormValue(['month']) as number | undefined
  const year = useFormValue(['year']) as number | undefined

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateStr = e.target.value
      if (dateStr) {
        const dayNum = parseInt(dateStr.split('-')[2], 10)
        onChange(set(dayNum))
      } else {
        onChange(unset())
      }
    },
    [onChange],
  )

  const dateValue =
    year && month && value != null
      ? `${year}-${String(month).padStart(2, '0')}-${String(value).padStart(2, '0')}`
      : ''

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      <input type="date" onChange={handleChange} value={dateValue} />
      {value != null && (
        <span style={{fontSize: 13, color: '#64707b'}}>{value} число</span>
      )}
    </div>
  )
}
