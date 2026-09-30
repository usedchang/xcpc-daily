#include<bits/stdc++.h>
using namespace std;
//#define endl '\n'交互需注释
typedef long long ll;
void solve(){
    int n,k;
    cin>>n>>k;
    int cnt=n/k;
    auto ask=[&](const vector<int>&S) ->int {
        cout<<"? "<<S.size()<<' ';
        for(int v:S) cout<<v<<' ';
        cout<<endl;
        int ans;cin>>ans;
        return ans;
    };
    vector<int>ans(n+1);
    vector<int>used(n+1);
    for(int j=1;j<cnt;j++){
        vector<int>S;
        vector<int>cur;
        for(int i=1;i<=n;i++) if(!used[i]) S.emplace_back(i);
        for(int t=1;t<=k;t++){
            int l=0,r=S.size();
            while(l<=r){
                int mid=l+r>>1;
                vector<int>T=cur;
                for(int idx=0;idx<mid;idx++) T.emplace_back(S[idx]);
                if(ask(T)>0) r=mid-1;
                else l=mid+1;
            }
            int val=S[l-1];
            used[val]=1;
            ans[val]=j;
            cur.emplace_back(val);
            S.erase(S.begin()+l-1);
        }
    }//对n/k个集合进行询问,平均每个数询问logn次
    for(int i=1;i<=n;i++) if(!ans[i]) ans[i]=cnt;
    cout<<"! ";
    for(int i=1;i<=n;i++) cout<<ans[i]<<' ';
    cout<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    solve();
    return 0;
}