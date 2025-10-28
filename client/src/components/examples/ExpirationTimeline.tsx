import { ExpirationTimeline } from '../ExpirationTimeline'
import { useState } from 'react'

export default function ExpirationTimelineExample() {
  const [selectedDays, setSelectedDays] = useState<number | null>(30);

  return (
    <ExpirationTimeline
      expirationDays={[7, 14, 30, 60, 90]}
      selectedDays={selectedDays}
      onSelectDays={setSelectedDays}
    />
  )
}
