const { PrismaClient } = require('@prisma/client')
const readXlsxFile = require('read-excel-file/node')
const socialCtrl = require('./social.controller')

const prisma = new PrismaClient()

const store = async (req, res) => {
  try {
    const {
      name,
      email,
      logo,
      isVIP,
      engagementRate,
      region,
      language,
      loginChannel,
      niche,
      contactLink,
      instagramUsername,
      telegramUsername,
      youtubeUsername,
      twitterUsername,
      tiktokUsername,
    } = req.body

    let { accountId } = req.body

    let influencerId
    if (!accountId) {
      if (
        await prisma.account.findFirst({
          where: {
            email,
          },
        })
      ) {
        return res.status(400).json('The email already exists')
      }
      const newAccount = await prisma.account.create({
        data: {
          name,
          email,
          logo,
          region,
          language,
        },
      })
      accountId = newAccount.id

      const newInfluencer = await prisma.influencer.create({
        data: {
          accountId,
          isVIP,
          engagementRate,
          loginChannel,
          niche,
          contactLink,
        },
      })

      influencerId = newInfluencer.id
    } else {
      if (!(await prisma.influencer.findUnique({ where: { accountId } })))
        return res.status(400).json("The account doesn't exist")

      await prisma.account.update({
        where: {
          id: accountId,
        },
        data: {
          name,
          email,
          logo: logo || '',
          region: region || '',
          language: language || '',
        },
      })

      const influencer = await prisma.influencer.update({
        where: {
          accountId,
        },
        data: {
          isVIP,
          engagementRate,
          loginChannel,
          niche,
          contactLink,
        },
      })
      influencerId = influencer.id
    }

    if (instagramUsername)
      await socialCtrl.storeInstagram(instagramUsername, accountId)
    if (telegramUsername)
      await socialCtrl.storeTelegram(telegramUsername, accountId)
    if (twitterUsername)
      await socialCtrl.storeTwitter(twitterUsername, accountId)
    if (youtubeUsername)
      await socialCtrl.storeYoutube(youtubeUsername, accountId)
    if (tiktokUsername) await socialCtrl.storeTiktok(tiktokUsername, accountId)

    await determineMainChannel(influencerId)

    const influencer = await prisma.influencer.findUnique({
      where: {
        id: influencerId,
      },
      include: {
        account: {
          include: {
            instagram: true,
            telegram: true,
            twitter: true,
            youtube: true,
            tiktok: true,
          },
        },
      },
    })

    res.json(influencer)
  } catch (error) {
    console.log(error)
    res.status(400).json(error)
  }
}

const determineMainChannel = async (influencerId) => {
  const influencer = await prisma.influencer.findUnique({
    where: {
      id: influencerId,
    },
    include: {
      account: {
        include: {
          instagram: true,
          telegram: true,
          twitter: true,
          youtube: true,
          tiktok: true,
        },
      },
    },
  })

  let mainChannel
  let maxFollowers = 0
  if (influencer.account.instagram?.followers) {
    if (influencer.account.instagram.followers >= maxFollowers) {
      maxFollowers = influencer.account.instagram.followers
      mainChannel = 'Instagram'
    }
  }
  if (influencer.account.twitter?.followers) {
    if (influencer.account.twitter.followers >= maxFollowers) {
      maxFollowers = influencer.account.twitter.followers
      mainChannel = 'Twitter'
    }
  }
  if (influencer.account.youtube?.subscribers) {
    if (influencer.account.youtube.subscribers >= maxFollowers) {
      maxFollowers = influencer.account.youtube.subscribers
      mainChannel = 'Youtube'
    }
  }
  if (influencer.account.telegram?.channelMembers) {
    if (influencer.account.telegram.channelMembers >= maxFollowers) {
      maxFollowers = influencer.account.telegram.channelMembers
      mainChannel = 'Telegram'
    }
  }
  if (influencer.account.tiktok?.followers) {
    if (influencer.account.tiktok.followers >= maxFollowers) {
      maxFollowers = influencer.account.tiktok.followers
      mainChannel = 'Tiktok'
    }
  }

  await prisma.influencer.update({
    where: {
      id: influencerId,
    },
    data: {
      mainChannel,
    },
  })
}

const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('Please upload an excel file!')
    }
    let path =
      __dirname + '/../resources/static/assets/uploads/' + req.file.filename

    readXlsxFile(path).then(async (rows) => {
      const titles = rows[0].map((title) => title.toLowerCase())

      rows.shift()
      for (const row of rows) {
        const accountData = {
          name: row[titles.indexOf('name')],
          email: row[titles.indexOf('email')],
          logo: row[titles.indexOf('logo')],
          region: row[titles.indexOf('region')],
          language: row[titles.indexOf('language')],
        }

        if (
          await prisma.account.findFirst({
            where: {
              email: accountData.email,
            },
          })
        ) {
          continue
        }

        const account = await prisma.account.create({
          data: accountData,
        })

        const influencerData = {
          accountId: account.id,
          isVIP: row[titles.indexOf('isvip')] === 'Yes',
          engagementRate: row[titles.indexOf('engagementrate')],
          loginChannel: row[titles.indexOf('loginchannel')],
          contactLink: row[titles.indexOf('contactlink')],
          niche: row[titles.indexOf('niche')],
          mainChannel: row[titles.indexOf('mainchannel')],
          promotionType: row[titles.indexOf('promotiontype')],
        }

        const influencer = await prisma.influencer.create({
          data: influencerData,
        })

        const telegramData = {
          accountId: account.id,
          username: row[titles.indexOf('telegramusername')],
          socialUrl: row[titles.indexOf('telegramsocialurl')],
        }

        await prisma.telegram.create({
          data: telegramData,
        })

        await socialCtrl.storeTelegram(telegramData.username, account.id)

        const twitterData = {
          accountId: account.id,
          username: row[titles.indexOf('twitterusername')],
          socialUrl: row[titles.indexOf('twittersocialurl')],
        }

        await prisma.twitter.create({
          data: twitterData,
        })

        await socialCtrl.storeTwitter(twitterData.username, account.id)

        const tiktokData = {
          accountId: account.id,
          username: row[titles.indexOf('tiktokusername')],
          socialUrl: row[titles.indexOf('tiktoksocialurl')],
        }

        await prisma.tiktok.create({
          data: tiktokData,
        })

        await socialCtrl.storeTiktok(tiktokData.username, account.id)

        const instagramData = {
          accountId: account.id,
          username: row[titles.indexOf('instagramusername')],
          socialUrl: row[titles.indexOf('instagramsocialurl')],
        }

        await prisma.instagram.create({
          data: instagramData,
        })

        await socialCtrl.storeTelegram(instagramData.username, account.id)

        const youtubeData = {
          accountId: account.id,
          username: row[titles.indexOf('youtubeusername')],
          socialUrl: row[titles.indexOf('youtubesocialurl')],
        }

        await prisma.youtube.create({
          data: youtubeData,
        })

        await socialCtrl.storeYoutube(youtubeData.username, account.id)

        await determineMainChannel(influencer.id)
      }
    })
    res.json('success')
  } catch (error) {
    console.log(error)
    res.status(500).json({ error })
  }
}

const getList = async (req, res) => {
  // try {
  //   await prisma.$connect();
  //   return res.json('connected');
  // } catch (err) {
  //   console.log(error);
  //   return res.json("Can't connect to db server");
  // }
  // To Do: filter
  try {
    const { ER, language, userName, location, promotionType } = req.query
    let { minPrice, maxPrice, minAudienceSize, maxAudienceSize } = req.query

    let influencers = await prisma.influencer.findMany({
      include: {
        account: {
          include: {
            telegram: {
              include: {
                telegramHistory: true,
              },
            },
            youtube: {
              include: {
                youtubeHistory: true,
              },
            },
            tiktok: {
              include: {
                tiktokHistory: true,
              },
            },
            twitter: {
              include: {
                twitterHistory: true,
              },
            },
            instagram: {
              include: {
                instagramHistory: true,
              },
            },
          },
        },
        campaigns: {
          include: {
            campaign: true,
          },
        },
      },
    })

    // const tagArr = tags ? tags.split(',') : []
    influencers = influencers.filter(
      (influencer) =>
        (!ER || (ER && influencer.engagementRate === ER)) &&
        (!language ||
          (language &&
            influencer.account.language
              .toLowerCase()
              .includes(language.toLowerCase()))) &&
        (!userName ||
          (userName &&
            influencer.account.name
              .toLowerCase()
              .includes(userName.toLowerCase()))) &&
        (!promotionType ||
          (promotionType && influencer.promotionType === promotionType)) &&
        (!location ||
          (location &&
            influencer.account.region
              .toLowerCase()
              .includes(location.toLowerCase()))),
    )

    influencers.forEach((influencer) => {
      const budgets = influencer.campaigns.map(
        (campaign) => campaign.campaign.negoBudget,
      )
      influencer.priceRange = [Math.min(...budgets), Math.max(...budgets)]
      if (!budgets.length) influencer.priceRange = [0, 0]
    })

    minAudienceSize = minAudienceSize ? minAudienceSize * 1 : 0
    maxAudienceSize = maxAudienceSize ? maxAudienceSize * 1 : Number.MAX_VALUE

    influencers = influencers.filter((influencer) => {
      let maxFollowers = Math.max(
        influencer.account.telegram
          ? influencer.account.telegram.channelMembers
          : 0,
        influencer.account.twitter ? influencer.account.twitter.followers : 0,
        influencer.account.tiktok ? influencer.account.tiktok.followers : 0,
        influencer.account.instagram
          ? influencer.account.instagram.followers
          : 0,
        influencer.account.youtube ? influencer.account.youtube.subscribers : 0,
      )
      return minAudienceSize <= maxFollowers && maxFollowers <= maxAudienceSize
    })

    if (minPrice && maxPrice) {
      minPrice = minPrice * 1
      maxPrice = maxPrice * 1

      influencers = influencers.filter(
        (influencer) =>
          (influencer.priceRange[1] >= minPrice &&
            influencer.priceRange[0] <= maxPrice) ||
          (influencer.priceRange[0] <= maxPrice &&
            influencer.priceRange[1] >= minPrice),
      )
    }

    res.json(influencers)
  } catch (error) {
    console.log(error)
    res.status(500).json(error)
  }
}

const getById = async (req, res) => {
  const { id } = req.params
  try {
    const influencer = await prisma.influencer.findUnique({
      where: {
        id: id * 1,
      },
      include: {
        account: {
          include: {
            telegram: {
              include: {
                telegramHistory: true,
              },
            },
            youtube: {
              include: {
                youtubeHistory: true,
              },
            },
            tiktok: {
              include: {
                tiktokHistory: true,
              },
            },
            twitter: {
              include: {
                twitterHistory: true,
              },
            },
            instagram: {
              include: {
                instagramHistory: true,
              },
            },
          },
        },
        campaigns: {
          include: {
            campaign: true,
          },
        },
      },
    })

    res.json(influencer)
  } catch (error) {
    console.log(error)
    res.status(400).json(error)
  }
}

const removeInfluencer = async (req, res) => {
  let { id } = req.params
  id = parseInt(id)
  try {
    const influencer = await prisma.influencer.findUnique({
      where: {
        id,
      },
    })
    if (influencer) {
      await prisma.account.delete({
        where: {
          id: influencer.accountId
        }
      })
      return res.json('success')
    } else {
      return res.status(400).json("The influencer doesn't exist")
    }
  } catch (error) {
    console.log(error)
    res.status(400).json(error)
  }
}

module.exports = {
  store,
  getList,
  getById,
  uploadExcel,
  removeInfluencer,
}
