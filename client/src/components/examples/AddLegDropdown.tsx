import { AddLegDropdown } from '../AddLegDropdown'

export default function AddLegDropdownExample() {
  return (
    <AddLegDropdown
      currentPrice={100}
      onAddLeg={(leg) => console.log('Adding leg:', leg)}
    />
  )
}
