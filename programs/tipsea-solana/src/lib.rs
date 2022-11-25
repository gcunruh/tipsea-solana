use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, MintTo, Token, TokenAccount, Mint };
use mpl_token_metadata::instruction::{create_master_edition_v3, create_metadata_accounts_v3, update_metadata_accounts_v2};
use mpl_token_metadata::state::{Metadata, TokenMetadataAccount, PREFIX, EDITION };
use solana_program::pubkey;

pub const TIPSEA: Pubkey = pubkey!("8a2z19H17vyQ89rmtR5tATWkGFutJ5gBWre2fthXimHa");
// pub const TIPSEA_COLLECTION: Pubkey = pubkey!("8a2z19H17vyQ89rmtR5tATWkGFutJ5gBWre2fthXimHa");

declare_id!("4fAkJwnBu84Ey1ikVrpJTSvFxZyahCoBuMdcHn4TMGad");

#[program]
pub mod tipsea_solana {

    use super::*;

    pub fn initialize_tipsea(_ctx: Context<InitializeTipsea>) -> Result<()> {
        Ok(())
    }

    pub fn create_tipsea(
        ctx: Context<CreateTipsea>,
        uri: String,
        title: String,
        symbol: String,
        creator_key: Pubkey,
    ) -> Result<()> {
        msg!("Initializing Tipsea Creation!");

        // paying for NFT with USDC
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from_account.to_account_info(),
                    to: ctx.accounts.fund.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            8000000000
        )?;

        let cpi_accounts =  MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        msg!("Create CPI context for mint...");
    
        token::mint_to(cpi_ctx, 1)?;
        msg!("Token Minted!");

        let account_info = vec![
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        msg!("Account info assigned!");

        let creator = vec![
            mpl_token_metadata::state::Creator {
                address: creator_key,
                verified: false,
                share: 100,
            },
            mpl_token_metadata::state::Creator {
                address: ctx.accounts.mint.key(),
                verified: false,
                share: 0,
            },
        ];
        msg!("Creator assigned!");

        // let collection = 
        // mpl_token_metadata::state::Collection {
        //     verified: false,
        //     key: collection_key,
        // };

        // msg!("Collection assigned!");

        invoke(
            &create_metadata_accounts_v3(
                ctx.accounts.token_metadata_program.key(),
                ctx.accounts.metadata.key(),
                ctx.accounts.mint.key(),
                ctx.accounts.mint_authority.key(),
                ctx.accounts.payer.key(),
                ctx.accounts.mint_authority.key(),
                title.clone(),
                symbol.clone(),
                uri.clone(),
                Some(creator),
                0,
                true,
                true,
                None,
                None,
                None,
            ),
            account_info.as_slice(),

        )?;
        msg!("Metadata created!");

        let master_edition_infos = vec![
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        msg!("Master edition infos assigned!");

        invoke(
            &create_master_edition_v3(
                ctx.accounts.token_metadata_program.key(),
                ctx.accounts.master_edition.key(),
                ctx.accounts.mint.key(),
                ctx.accounts.mint_authority.key(),
                ctx.accounts.mint_authority.key(),
                ctx.accounts.metadata.key(),
                ctx.accounts.payer.key(),
                Some(0),
            ),
            master_edition_infos.as_slice(),
        )?;
        msg!("Master Edition created!");

        invoke(
            &update_metadata_accounts_v2(
                ctx.accounts.token_metadata_program.key(),
                ctx.accounts.metadata.key(),
                ctx.accounts.mint_authority.key(),
                Some(creator_key),
                None,
                Some(true),
                Some(true),
            ),
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.mint_authority.to_account_info(),
            ],
        )?;

        Ok(())

    }

    pub fn redeem(
        ctx: Context<Redeem>,
    ) -> Result<()> {

        let nft_token_account = &ctx.accounts.token_account;
        let user = &ctx.accounts.signer;
        let nft_mint_account = &ctx.accounts.mint;

        assert_eq!(nft_token_account.owner, user.key());
        assert_eq!(nft_token_account.mint, nft_mint_account.key());
        assert_eq!(nft_token_account.amount, 1);

        //We expect a Metaplex Master Edition so we derive it given mint as seeds
        //Then compare to the Mint account passed into the program

        let master_edition_seed = &[
            PREFIX.as_bytes(),
            ctx.accounts.token_metadata_program.key.as_ref(),
            nft_token_account.mint.as_ref(),
            EDITION.as_bytes()
        ];

        let (master_edition_key, _master_edition_seed) =
            Pubkey::find_program_address(master_edition_seed, ctx.accounts.token_metadata_program.key);
        
        assert_eq!(master_edition_key, ctx.accounts.mint.key());

        let nft_metadata_account = &ctx.accounts.metadata_account;
        let nft_mint_account_pubkey = &ctx.accounts.mint.key();

        let metadata_seed = &[
            PREFIX.as_bytes(),
            ctx.accounts.token_metadata_program.key.as_ref(),
            nft_mint_account_pubkey.as_ref(),
        ];

        let (metadata_derived_key, _bump_seed) =
            Pubkey::find_program_address(
                metadata_seed,
                ctx.accounts.token_metadata_program.key
            );
        //check that derived key is the current metadata account key
        assert_eq!(metadata_derived_key, nft_metadata_account.key());

        if ctx.accounts.metadata_account.data_is_empty() {
            return Err(ErrorCode::NotInitialized.into());
        };

        //Get the metadata account struct so we can access its values
        let metadata_full_account =
            &mut Metadata::from_account_info(&ctx.accounts.metadata_account)?;
        
        let full_metadata_clone = metadata_full_account.clone();

        let expected_creator =
            TIPSEA;
            //solana_program::pubkey!("BuSmTfRJFB7ewseydjbC8DaRYYuhPBPLGyeK7cxNLx1k");
        
            
        //Verify creator is present in metadata
        //NOTE: The first address in 'creators' is the Candy Machine Address
        // Therefore, the expected_creator should be the Candy Machine Address here
        //NOTE: May want to use updateAuthority field if CMA is not known in advance?
        assert_eq!(
            full_metadata_clone.data.creators.as_ref().unwrap()[0].address,
            expected_creator
        );

        //check if creator is verified
        if !full_metadata_clone.data.creators.unwrap()[0].verified {
            //return error as creator is not verified 
            return Err(ErrorCode::CreatorNotVerified.into());
        };

        // redeeming with USDC
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.fund.to_account_info(),
                    to: ctx.accounts.fund.to_account_info(),
                    authority: ctx.accounts.to_account.to_account_info(),
                },
            ),
            7
        )?;
        
        Ok(())
    }

}

#[derive(Accounts)]
pub struct InitializeTipsea<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(
        init,
        seeds=[b"fund".as_ref(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer,
    )]
    pub fund: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateTipsea<'info> {
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,
    // #[account(mut)]
    pub token_program: Program<'info, Token>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_metadata_program: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub payer: AccountInfo<'info>,
    #[account(mut, constraint = from_account.owner == mint_authority.key())]
    pub from_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub fund: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub rent: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, constraint = to_account.owner == signer.key())]
    pub to_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub fund: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub metadata_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub from: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Mint failed!")]
    MintFailed,

    #[msg("Metadata account create failed!")]
    MetadataCreateFailed,

    #[msg("Master Edition create failed!")]
    MasterCreateFailed,

    #[msg("Not enough tokens to pay for this minting")]
    NotEnoughTokens,

    #[msg("Not enough SOL to pay for this minting")]
    NotEnoughSOL,

    #[msg("Not Initialized")]
    NotInitialized,

    #[msg("Creator is not verified")]
    CreatorNotVerified,

}