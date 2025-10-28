import { OptionLegEditor } from '../OptionLegEditor'
import { useState } from 'react'
import type { OptionLeg } from '@shared/schema'

export default function OptionLegEditorExample() {
  const [leg, setLeg] = useState<OptionLeg>({
    id: "1",
    type: "call",
    position: "long",
    strike: 105,
    quantity: 1,
    premium: 3.5,
    expirationDays: 30,
  });

  return (
    <OptionLegEditor
      leg={leg}
      onUpdate={setLeg}
      onRemove={() => console.log('Remove clicked')}
      underlyingPrice={100}
    />
  )
}
