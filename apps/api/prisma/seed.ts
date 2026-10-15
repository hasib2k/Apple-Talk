import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const interests = [
  { slug: 'music', label: 'Music', emoji: '🎵' },
  { slug: 'gaming', label: 'Gaming', emoji: '🎮' },
  { slug: 'anime', label: 'Anime', emoji: '🌸' },
  { slug: 'movies', label: 'Movies', emoji: '🎬' },
  { slug: 'books', label: 'Books', emoji: '📚' },
  { slug: 'travel', label: 'Travel', emoji: '✈️' },
  { slug: 'food', label: 'Food', emoji: '🍜' },
  { slug: 'sports', label: 'Sports', emoji: '⚽' },
  { slug: 'tech', label: 'Tech', emoji: '💻' },
  { slug: 'art', label: 'Art', emoji: '🎨' },
  { slug: 'language_learning', label: 'Language Learning', emoji: '🌍' },
  { slug: 'fitness', label: 'Fitness', emoji: '💪' },
  { slug: 'cooking', label: 'Cooking', emoji: '👨‍🍳' },
  { slug: 'photography', label: 'Photography', emoji: '📸' },
  { slug: 'coding', label: 'Coding', emoji: '⌨️' },
  { slug: 'finance', label: 'Finance', emoji: '💰' },
  { slug: 'psychology', label: 'Psychology', emoji: '🧠' },
  { slug: 'philosophy', label: 'Philosophy', emoji: '🤔' },
  { slug: 'history', label: 'History', emoji: '📜' },
  { slug: 'science', label: 'Science', emoji: '🔬' },
  { slug: 'startups', label: 'Startups', emoji: '🚀' },
  { slug: 'fashion', label: 'Fashion', emoji: '👗' },
  { slug: 'nature', label: 'Nature', emoji: '🌿' },
  { slug: 'pets', label: 'Pets', emoji: '🐾' },
  { slug: 'meditation', label: 'Meditation', emoji: '🧘' },
];

async function main() {
  console.log('Seeding interests...');
  for (const interest of interests) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: {},
      create: interest,
    });
  }
  console.log(`Seeded ${interests.length} interests.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
