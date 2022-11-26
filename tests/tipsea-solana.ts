import * as anchor from '@project-serum/anchor';
import { Program, Wallet } from '@project-serum/anchor';
import { TipseaSolana } from '../target/types/tipsea_solana';
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
const { SystemProgram } = anchor.web3;
import { PROGRAM_ADDRESS } from '@metaplex-foundation/mpl-token-metadata';
import { PublicKey, Keypair } from '@solana/web3.js';

const provider = anchor.AnchorProvider.env();
anchor.setProvider( provider );
const program = anchor.workspace.TipseaSolana as Program<TipseaSolana>;
const programId = program.programId;
const wallet = provider.wallet as Wallet;
const to_pk = [ 74, 106, 202, 54, 86, 129, 111, 155, 100, 218, 213, 195, 205, 1, 215, 89, 139, 140, 113, 218, 161, 3, 81, 72, 193, 134, 1, 49, 141, 19, 74, 19, 128, 117, 89, 82, 216, 23, 206, 139, 19, 125, 107, 214, 201, 219, 184, 184, 206, 27, 230, 196, 179, 58, 194, 213, 197, 190, 28, 239, 77, 121, 8, 209 ] as number[];
const to_wallet = Keypair.fromSecretKey(
  Uint8Array.from( to_pk )
);

const HERA_USDC_MINT = new PublicKey( "5kU3fkzBcmpirSbjDY99QqQ3Zq8ABks1JMzZxAVx16Da" );
const TOKEN_METADATA_PROGRAM_ID = new PublicKey( PROGRAM_ADDRESS );
const TIPSEA = new PublicKey( "8a2z19H17vyQ89rmtR5tATWkGFutJ5gBWre2fthXimHa" );

describe( 'tipsea-nft', async () =>
{
  const getMetadata = async (
    mint: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> =>
  {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from( "metadata" ),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[ 0 ];
  };

  const getMasterEdition = async (
    mint: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> =>
  {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from( "metadata" ),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
          Buffer.from( "edition" ),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[ 0 ];
  };

  const fundSeeds = [
    Buffer.from( "fund" ),
    HERA_USDC_MINT.toBuffer()
  ];

  const [ fundPda, _fundBump ] = await anchor.web3.PublicKey
    .findProgramAddress(
      fundSeeds,
      programId,
    );

  let fromAta: anchor.web3.PublicKey;
  let mintKey: anchor.web3.Keypair;
  let NftTokenAccount: anchor.web3.PublicKey;
  let metadataAddress: anchor.web3.PublicKey;
  let masterEdition: anchor.web3.PublicKey;

  before( 'prep values', async () =>
  {
    fromAta = await getAssociatedTokenAddress(
      HERA_USDC_MINT,
      provider.wallet.publicKey,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    mintKey = anchor.web3.Keypair.generate();

    NftTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      to_wallet.publicKey
    );

    metadataAddress = await getMetadata( mintKey.publicKey );
    masterEdition = await getMasterEdition( mintKey.publicKey );

    const lamports: number =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );

    const mint_tx = new anchor.web3.Transaction();

    mint_tx.add(
      anchor.web3.SystemProgram.createAccount( {
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      } ),
      createInitializeMintInstruction(
        mintKey.publicKey,
        0,
        wallet.publicKey,
        wallet.publicKey
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        NftTokenAccount,
        to_wallet.publicKey,
        mintKey.publicKey
      )
    );

    const res = await program.provider.sendAndConfirm( mint_tx, [ mintKey ] );

    console.log( "Account: ", res );
    console.log( "Mint key: ", mintKey.publicKey.toString() );
    console.log( "ATA: ", NftTokenAccount.toBase58() );
    console.log( "Metadata address: ", metadataAddress.toBase58() );
    console.log( "MasterEdition: ", masterEdition.toBase58() );

  } );

  // it("initialize tipsea", async() => {
  //   console.log("Initializing...");
  //   let tx = new anchor.web3.Transaction();

  //   tx.add(
  //     await program.methods
  //       .initializeTipsea()
  //       .accounts({
  //         initializer: provider.wallet.publicKey,
  //         fund: fundPda,
  //         mint: HERA_USDC_MINT
  //       })
  //       .instruction()
  //   );

  //   await provider.sendAndConfirm(tx);
  //   console.log("Initialized!");
  // })

  it( "mint nft", async () =>
  {

    let tx = new anchor.web3.Transaction();

    tx.add(
      await program.methods.createTipsea(
        "https://tipsea.s3.us-west-2.amazonaws.com/metadata/test_metadata.json",
        "Martini",
        "MAR",
        TIPSEA
      )
        .accounts( {
          mintAuthority: wallet.publicKey,
          mint: mintKey.publicKey,
          tokenAccount: NftTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          metadata: metadataAddress,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          payer: wallet.publicKey,
          fromAccount: fromAta,
          fund: fundPda,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          masterEdition: masterEdition,
        },
        ).instruction() );

    const final = await program.provider.sendAndConfirm( tx );

    console.log( "Done!", final );
  } );

  it( "redeem", async () =>
  {
    console.log( "Redeeming..." );

    const toAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      to_wallet,
      HERA_USDC_MINT,
      to_wallet.publicKey
    );

    let tx = new anchor.web3.Transaction();

    tx.add(
      await program.methods
        .redeem(
          _fundBump
        )
        .accounts( {
          signer: to_wallet.publicKey,
          toAccount: toAta.address,
          tokenMint: HERA_USDC_MINT,
          fund: fundPda,
          mint: mintKey.publicKey,
          tokenAccount: NftTokenAccount,
          metadataAccount: metadataAddress,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } )
        .instruction()
    );

    await provider.sendAndConfirm( tx, [to_wallet] );
    console.log( "Redeemed!", tx );
  } );

  it( "withdraw", async () =>
  {
    console.log( "Withdrawing..." );

    let tx = new anchor.web3.Transaction();

    tx.add(
      await program.methods
        .withdraw(
          _fundBump,
          new anchor.BN(1000000000)
        )
        .accounts( {
          authority: provider.wallet.publicKey,
          toAccount: fromAta,
          fund: fundPda,
          tokenMint: HERA_USDC_MINT,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } )
        .instruction()
    );

    await provider.sendAndConfirm( tx );
    console.log( "Withdrew!", tx );
  } );


} );