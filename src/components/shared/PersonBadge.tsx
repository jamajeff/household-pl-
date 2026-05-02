import clsx from 'clsx'
import type { Person } from '../../types'

interface Props {
  person: Person
  name1: string
  name2: string
  size?: 'sm' | 'xs'
}

const COLORS: Record<Person, string> = {
  person1: 'bg-blue-100 text-blue-700',
  person2: 'bg-purple-100 text-purple-700',
  shared: 'bg-gray-100 text-gray-600',
}

export function PersonBadge({ person, name1, name2, size = 'sm' }: Props) {
  const label = person === 'person1' ? name1 : person === 'person2' ? name2 : 'Shared'
  return (
    <span
      className={clsx(
        'inline-block rounded font-medium',
        COLORS[person],
        size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5',
      )}
    >
      {label}
    </span>
  )
}
