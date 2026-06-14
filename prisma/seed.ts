import { PrismaClient, Role, VideoStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kt.dev' },
    update: {},
    create: {
      email: 'admin@kt.dev',
      name: 'Admin User',
      role: Role.ADMIN,
      passwordHash,
    },
  });
  const user = await prisma.user.upsert({
    where: { email: 'user@kt.dev' },
    update: {},
    create: {
      email: 'user@kt.dev',
      name: 'User',
      role: Role.USER,
      passwordHash,
    },
  });

  const samples = [
    {
      t: 'Sample Video 1',
      mp4: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://sample-videos.com/img/Sample-jpg-image-50kb.jpg',
      duration: 10,
      userId: 1,
    },
    {
      t: 'Sample Video 2',
      mp4: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://sample-videos.com/img/Sample-jpg-image-50kb.jpg',
      duration: 10,
      userId: 1,
    },
    {
      t: 'Sample Video 3',
      mp4: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://sample-videos.com/img/Sample-jpg-image-50kb.jpg',
      duration: 10,
      userId: 1,
    },
    {
      t: 'Sample Video 4',
      mp4: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://sample-videos.com/img/Sample-jpg-image-50kb.jpg',
      duration: 10,
      userId: 1,
    },
    {
      t: 'Sample Video 5',
      mp4: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://sample-videos.com/img/Sample-jpg-image-50kb.jpg',
      duration: 10,
      userId: 1,
    },
    {
      t: 'Sample Video 6',
      mp4: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      thumbnail: 'https://sample-videos.com/img/Sample-jpg-image-50kb.jpg',
      duration: 10,
      userId: 1,
    },
  ];

  const count = await prisma.video.count();
  if (count === 0) {
    const data = Array.from({ length: 12 }, (_, i) => {
      const s = samples[i % samples.length];
      return {
        ownerId: i % 2 === 0 ? admin?.id : user?.id,
        title: `${s.t} ${i + 1}`,
        description: `Description for ${s.t} ${i + 1}`,
        status: VideoStatus.READY,
        originalKey: `sample-video-${i + 1}.mp4`,
        thubnailUrl: `https://sample-videos.com/img/Sample-jpg-image-50kb.jpg`,
        playbackUrl: s.mp4,
        durationSec: 10 + i * 5,
        viewCount: Math.floor(Math.random() * 5000),
      };
    });
    await prisma.video.createMany({ data });
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
